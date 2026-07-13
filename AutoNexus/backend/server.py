from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
import shutil
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import re
import bcrypt
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required but not set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# SECURITY: this must be false/unset in production. It exists purely so this
# codebase can be tested locally without real Twilio/email credentials. When
# true, a password-reset code that couldn't be delivered through a real
# channel is echoed back in the API response instead of only being logged
# server-side. That is a real account-takeover risk if it's ever accidentally
# left on in a live deployment — see deliver_reset_code() and
# /auth/forgot-password for exactly where this is used.
DEV_EXPOSE_RESET_CODES = os.environ.get('DEV_EXPOSE_RESET_CODES', 'false').lower() == 'true'

# Image upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="AutoNexus API", version="1.0.0")

# Rate limiting — protects /auth/login and /auth/signup from brute-force and
# spam. Keyed by client IP; 5 attempts/minute is generous for a real user
# (who mistypes a password once or twice) but blocks automated guessing.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # Shaped as {"detail": ...} to match every other error response in this
    # API, so the frontend's existing `error.response?.data?.detail` handling
    # picks it up with no frontend changes required.
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a minute and try again."}
    )

# FIX: Register CORS middleware immediately after app creation, before routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Serve uploaded images as static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ============== MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    phone: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: str = "buyer"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    seller_id: Optional[str] = None
    favorites: List[str] = []  # list of part IDs
    is_admin: bool = False
    # Bumped whenever the password is reset, so JWTs issued before the reset
    # stop being accepted (see create_token / get_current_user). Existing
    # documents without this field default to 0 via .get() reads elsewhere —
    # no migration needed.
    token_version: int = 0

class ForgotPasswordRequest(BaseModel):
    identifier: str  # phone or email

class ResetPasswordRequest(BaseModel):
    identifier: str  # same identifier used to request the code
    code: str
    new_password: str

class SignupRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    identifier: str  # phone or email
    password: str

class Seller(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    rating: float = 0.0
    rating_count: int = 0
    sales_count: int = 0
    verified: bool = False
    active: bool = True
    status: str = "pending"  # pending | approved | rejected
    id_document: Optional[str] = None  # national ID or business registration number (onboarding check)
    last_active: Optional[str] = None
    image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SparePart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    part_number: str
    description: Optional[str] = None
    category: str
    brands: List[str]
    models: List[str]
    years: List[str]
    seller_id: str
    price: int
    stock: int
    condition: str = "new"
    image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PartRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_contact: str  # phone or email, whichever the user signed up with
    user_name: Optional[str] = None
    vehicle_brand: str
    vehicle_model: str
    vehicle_year: str
    part_name: str
    description: Optional[str] = None
    urgency: str = "normal"
    location: str
    status: str = "open"  # open | responded | fulfilled
    responses: List[dict] = []
    accepted_seller_id: Optional[str] = None
    accepted_price: Optional[int] = None
    rated: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Rating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    user_id: str
    user_name: Optional[str] = None
    request_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RatingCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

class SellerCreate(BaseModel):
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    image: Optional[str] = None
    id_document: str  # National ID number or business registration number — required so admin can vet applicants

class SellerUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    image: Optional[str] = None

class AdminSellerUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    image: Optional[str] = None
    verified: Optional[bool] = None
    active: Optional[bool] = None
    status: Optional[str] = None
    # NOTE: `rating` intentionally not editable here anymore — it's now computed
    # automatically from real buyer ratings (see /sellers/{id}/rate). Manually
    # overwriting it would immediately be overwritten again by the next rating.

class AdminSellerCreate(BaseModel):
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    image: Optional[str] = None
    id_document: Optional[str] = None
    verified: bool = True

class SparePartCreate(BaseModel):
    name: str
    part_number: str
    description: Optional[str] = None
    category: str
    brands: List[str]
    models: List[str]
    years: List[str]
    price: int
    stock: int
    condition: str = "new"
    image: Optional[str] = None

class SparePartUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    stock: Optional[int] = None
    condition: Optional[str] = None
    image: Optional[str] = None

class PartRequestCreate(BaseModel):
    vehicle_brand: str
    vehicle_model: str
    vehicle_year: str
    part_name: str
    description: Optional[str] = None
    urgency: str = "normal"
    location: str

class RequestResponse(BaseModel):
    seller_id: str
    price: int
    condition: str
    message: str
    available: bool = True

class UserUpdate(BaseModel):
    name: Optional[str] = None

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False

# Computed once at process startup so failed logins for a non-existent
# identifier still pay the same bcrypt cost as a real password check —
# without this, response time itself would leak whether an account exists.
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"timing-attack-mitigation", bcrypt.gensalt()).decode("utf-8")

def normalize_phone(raw: str) -> str:
    """Canonicalize a user-typed phone number to the +237XXXXXXXXX form used
    in storage, so login lookups match regardless of how the user typed it
    (with/without +237, with 0 prefix, with spaces)."""
    digits = re.sub(r'[^\d+]', '', raw.strip())
    if digits.startswith('+237'):
        return digits
    if digits.startswith('237'):
        return '+' + digits
    if digits.startswith('0'):
        digits = digits[1:]
    if len(digits) == 9:
        return '+237' + digits
    return digits

def generate_reset_code() -> str:
    """Cryptographically secure 6-digit numeric code (NOT the `random`
    module — that's not safe for anything security-sensitive, since its
    output is predictable given enough samples). secrets.randbelow draws
    from the OS's CSPRNG."""
    return f"{secrets.randbelow(1_000_000):06d}"

async def deliver_reset_code(user: dict, code: str) -> dict:
    """
    Sends a password-reset code via whichever channel matches how the user
    registered — SMS/WhatsApp for a phone account, email for an email
    account. Never raises: a delivery failure must not change the shape of
    the API response, or it becomes an account-enumeration signal.

    Returns {"delivered": bool, "channel": str, "demo_code": str|None}.
    `demo_code` is only ever populated when there was no real channel to
    send through — see DEV_EXPOSE_RESET_CODES for the one place that's
    allowed to leave this repo's process.
    """
    if user.get("phone"):
        twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
        twilio_sms_from = os.environ.get('TWILIO_PHONE_NUMBER')
        twilio_wa_from = os.environ.get('TWILIO_WHATSAPP_NUMBER')

        if twilio_sid and twilio_token and (twilio_sms_from or twilio_wa_from):
            try:
                from twilio.rest import Client as TwilioClient
                tc = TwilioClient(twilio_sid, twilio_token)
                body = (
                    f"Your AutoNexus password reset code is {code}. "
                    f"It expires in 10 minutes. Never share this code with anyone."
                )
                if twilio_sms_from:
                    tc.messages.create(body=body, from_=twilio_sms_from, to=user["phone"])
                else:
                    tc.messages.create(body=body, from_=twilio_wa_from, to=f"whatsapp:{user['phone']}")
                return {"delivered": True, "channel": "sms", "demo_code": None}
            except Exception as e:
                logger.error(f"Reset code SMS delivery failed for user_id={user['id']}: {e}")
                return {"delivered": False, "channel": "sms", "demo_code": code}
        else:
            logger.warning(f"TWILIO not configured — reset code for user_id={user['id']} not sent (demo mode)")
            return {"delivered": False, "channel": "demo", "demo_code": code}
    else:
        # Pluggable seam for an email provider (SendGrid, Mailgun, AWS SES,
        # SMTP...). None is wired up yet — when one is, check its env var(s)
        # here the same way Twilio is checked above, and send through its
        # SDK inside the try block. Until then this always falls through to
        # demo mode for email accounts.
        email_provider_key = os.environ.get('SENDGRID_API_KEY')  # example seam
        if email_provider_key:
            try:
                # e.g.:
                # from sendgrid import SendGridAPIClient
                # from sendgrid.helpers.mail import Mail
                # sg = SendGridAPIClient(email_provider_key)
                # sg.send(Mail(from_email=..., to_emails=user["email"],
                #              subject="Your AutoNexus reset code",
                #              plain_text_content=f"Your code is {code}..."))
                raise NotImplementedError("Wire up an email provider SDK here")
            except Exception as e:
                logger.error(f"Reset code email delivery failed for user_id={user['id']}: {e}")
                return {"delivered": False, "channel": "email", "demo_code": code}
        else:
            logger.warning(f"No email provider configured — reset code for user_id={user['id']} not sent (demo mode)")
            return {"delivered": False, "channel": "demo", "demo_code": code}

def create_token(user_id: str, role: str, token_version: int = 0):
    payload = {
        "user_id": user_id,
        "role": role,
        "token_version": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Common auto-part terms that mean the same thing across English, French, and
# local pidgin usage. Searching for any one term also matches parts listed
# under a synonym — buyers rarely know the "official" English part name.
SEARCH_SYNONYM_GROUPS = [
    ["brake", "brakes", "frein", "freins", "plaquette", "plaquettes"],
    ["shock", "shocks", "shock absorber", "amortisseur", "amortisseurs"],
    ["battery", "batterie", "batteries"],
    ["headlight", "headlights", "headlamp", "phare", "phares"],
    ["tire", "tyre", "tires", "tyres", "pneu", "pneus"],
    ["engine", "moteur", "motor"],
    ["alternator", "alternateur"],
    ["radiator", "radiateur"],
    ["clutch", "embrayage"],
    ["filter", "filtre", "filters", "filtres"],
    ["spark plug", "spark plugs", "bougie", "bougies"],
    ["windshield", "windscreen", "pare-brise"],
    ["bumper", "pare-choc", "pare-chocs"],
    ["starter", "demarreur", "démarreur"],
    ["gearbox", "transmission", "boite de vitesse", "boîte de vitesse"],
    ["suspension", "suspensions"],
    ["exhaust", "pot d'echappement", "pot d'échappement", "silencieux"],
    ["belt", "belts", "courroie", "courroies"],
    ["mirror", "mirrors", "retroviseur", "rétroviseur"],
    ["wiper", "wipers", "essuie-glace"],
]
SEARCH_SYNONYM_LOOKUP = {}
for group in SEARCH_SYNONYM_GROUPS:
    for term in group:
        SEARCH_SYNONYM_LOOKUP[term.lower()] = group

def expand_search_word(word: str) -> list:
    """Return the word plus any synonyms so search tolerates French/pidgin
    part names and common phrasing differences."""
    return SEARCH_SYNONYM_LOOKUP.get(word.lower(), [word])

async def touch_seller_activity(seller_id: str):
    if not seller_id:
        return
    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
    )

def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "phone": user.get("phone"),
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user["role"],
        "seller_id": user.get("seller_id"),
        "is_admin": user.get("is_admin", False)
    }

def build_catalog_pdf(seller: dict, parts: list) -> bytes:
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"{seller['name']} - Catalog")
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(seller["name"], styles["Title"]))
    elements.append(Paragraph(f"{seller.get('location', '')}", styles["Normal"]))
    contact_bits = []
    if seller.get("phone"):
        contact_bits.append(f"Phone: {seller['phone']}")
    if seller.get("whatsapp"):
        contact_bits.append(f"WhatsApp: {seller['whatsapp']}")
    if contact_bits:
        elements.append(Paragraph(" | ".join(contact_bits), styles["Normal"]))
    elements.append(Spacer(1, 8 * mm))

    table_data = [["Name", "Part #", "Category", "Price (FCFA)", "Stock", "Condition"]]
    for p in parts:
        table_data.append([
            p.get("name", ""),
            p.get("part_number", ""),
            p.get("category", ""),
            f"{p.get('price', 0):,}",
            str(p.get("stock", 0)),
            p.get("condition", ""),
        ])

    if len(table_data) == 1:
        elements.append(Paragraph("No products listed yet.", styles["Normal"]))
    else:
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a2f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(table)

    doc.build(elements)
    return buffer.getvalue()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if payload.get("token_version", 0) != user.get("token_version", 0):
            # Password was reset since this token was issued — the old
            # session must not keep working after that.
            raise HTTPException(status_code=401, detail="Session expired, please log in again")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user or payload.get("token_version", 0) != user.get("token_version", 0):
            return None
        return user
    except:
        return None

async def get_current_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/signup")
@limiter.limit("5/minute")
async def signup(request: Request, data: SignupRequest):
    phone = normalize_phone(data.phone) if data.phone else None
    email = data.email.strip().lower() if data.email else None

    if not phone and not email:
        raise HTTPException(status_code=400, detail="Provide a phone number or an email address")

    if phone and not re.match(r'^\+237[0-9]{9}$', phone):
        raise HTTPException(status_code=400, detail="Invalid Cameroon phone number. Format: +237XXXXXXXXX")

    if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing_query = {"$or": []}
    if phone:
        existing_query["$or"].append({"phone": phone})
    if email:
        existing_query["$or"].append({"email": email})
    existing = await db.users.find_one(existing_query, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this phone or email already exists")

    new_user = User(
        phone=phone,
        email=email,
        name=data.name,
        password_hash=hash_password(data.password)
    )
    user_dict = new_user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    # A sparse unique index only excludes a document when the field is
    # ABSENT, not when it's present as `null` -- model_dump() always emits
    # `phone`/`email` even when unset, so without this, the second phone-only
    # (or email-only) signup would collide on a stored `null` and crash with
    # a raw DuplicateKeyError instead of ever reaching this line.
    if user_dict.get('phone') is None:
        del user_dict['phone']
    if user_dict.get('email') is None:
        del user_dict['email']
    await db.users.insert_one(user_dict)

    token = create_token(user_dict["id"], user_dict["role"], user_dict.get("token_version", 0))
    return {"token": token, "user": public_user(user_dict)}

@api_router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest):
    identifier = data.identifier.strip()
    is_email = "@" in identifier
    query = {"email": identifier.lower()} if is_email else {"phone": normalize_phone(identifier)}

    user = await db.users.find_one(query, {"_id": 0})
    if not user:
        verify_password(data.password, _DUMMY_PASSWORD_HASH)  # pay the same bcrypt cost either way
        logger.warning(f"Login failed: no user for query type={'email' if is_email else 'phone'}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.get("password_hash", "")):
        logger.warning(f"Login failed: password mismatch for user_id={user['id']}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["id"], user["role"], user.get("token_version", 0))
    if user.get("seller_id"):
        await touch_seller_activity(user["seller_id"])
    return {"token": token, "user": public_user(user)}

@api_router.post("/auth/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    """
    Always returns the same generic message regardless of whether the
    identifier matches an account — this is the primary anti-enumeration
    control for this endpoint. Never branch the response body on whether a
    user was found.
    """
    identifier = data.identifier.strip()
    is_email = "@" in identifier
    query = {"email": identifier.lower()} if is_email else {"phone": normalize_phone(identifier)}

    generic_response = {
        "message": "If an account exists for that phone or email, a reset code has been sent."
    }

    user = await db.users.find_one(query, {"_id": 0})
    if not user:
        logger.info(f"Forgot-password requested for unknown identifier type={'email' if is_email else 'phone'}")
        return generic_response

    code = generate_reset_code()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "reset_code_hash": hash_password(code),
            "reset_code_expires": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "reset_code_attempts": 0,
        }}
    )

    delivery = await deliver_reset_code(user, code)
    logger.info(
        f"Forgot-password code issued for user_id={user['id']} "
        f"channel={delivery['channel']} delivered={delivery['delivered']}"
    )

    # DEV-ONLY escape hatch — see the DEV_EXPOSE_RESET_CODES definition for
    # why this must never be true in production. Note this necessarily
    # reveals account existence (the field is only present when a real user
    # was found) — an explicit, opt-in trade-off for local testability, not
    # something that can happen by accident with the flag unset.
    if DEV_EXPOSE_RESET_CODES and not delivery["delivered"]:
        generic_response["dev_code"] = delivery["demo_code"]
        generic_response["dev_note"] = (
            "DEV MODE ONLY — no SMS/email provider is configured, so the code "
            "is included here instead of actually being sent. This field will "
            "not exist in production (DEV_EXPOSE_RESET_CODES must stay unset)."
        )

    return generic_response

@api_router.post("/auth/reset-password")
@limiter.limit("10/hour")
async def reset_password(request: Request, data: ResetPasswordRequest):
    identifier = data.identifier.strip()
    is_email = "@" in identifier
    query = {"email": identifier.lower()} if is_email else {"phone": normalize_phone(identifier)}

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Every failure path below raises the exact same message. Distinguishing
    # "no such user" from "wrong code" from "expired" from "too many tries"
    # would both leak account existence and hand an attacker a signal about
    # how close a guess was — so all of them collapse to one response.
    generic_error = HTTPException(status_code=400, detail="Invalid or expired code")

    user = await db.users.find_one(query, {"_id": 0})
    if not user:
        verify_password(data.code, _DUMMY_PASSWORD_HASH)  # pay the same bcrypt cost either way
        raise generic_error

    reset_hash = user.get("reset_code_hash")
    reset_expires = user.get("reset_code_expires")
    attempts = user.get("reset_code_attempts", 0)

    if not reset_hash or not reset_expires:
        verify_password(data.code, _DUMMY_PASSWORD_HASH)
        raise generic_error

    if attempts >= 5:
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new code.")

    if datetime.now(timezone.utc) > datetime.fromisoformat(reset_expires):
        # Clean up the stale code so it can't be brute-forced after expiry either.
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"reset_code_hash": "", "reset_code_expires": "", "reset_code_attempts": ""}}
        )
        raise generic_error

    if not verify_password(data.code, reset_hash):
        await db.users.update_one({"id": user["id"]}, {"$inc": {"reset_code_attempts": 1}})
        logger.warning(f"Reset-password: wrong code for user_id={user['id']} (attempt {attempts + 1}/5)")
        raise generic_error

    if verify_password(data.new_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="New password must be different from your current password")

    # Success: set the new password, invalidate the code (single-use), and
    # bump token_version so any JWT issued before this reset — including one
    # an attacker may have already stolen — stops being accepted.
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password_hash": hash_password(data.new_password)},
            "$unset": {"reset_code_hash": "", "reset_code_expires": "", "reset_code_attempts": ""},
            "$inc": {"token_version": 1},
        }
    )
    logger.info(f"Password reset successful for user_id={user['id']}")
    return {"message": "Password updated successfully. Please log in with your new password."}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {**public_user(user), "favorites": user.get("favorites", [])}

@api_router.put("/auth/me")
async def update_me(data: UserUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return updated

# ============== FAVORITES ==============

@api_router.get("/favorites")
async def get_favorites(user: dict = Depends(get_current_user)):
    """Get user's saved/favorite parts"""
    fav_ids = user.get("favorites", [])
    if not fav_ids:
        return {"parts": []}
    cursor = db.parts.find({"id": {"$in": fav_ids}}, {"_id": 0})
    parts = await cursor.to_list(100)
    # attach seller info
    seller_ids = list({p["seller_id"] for p in parts})
    sellers_map = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}
    for part in parts:
        seller = sellers_map.get(part["seller_id"])
        if seller:
            part["seller"] = {"id": seller["id"], "name": seller["name"], "rating": seller["rating"],
                              "whatsapp": seller["whatsapp"], "phone": seller["phone"], "verified": seller["verified"]}
    return {"parts": parts, "total": len(parts)}

@api_router.post("/favorites/{part_id}")
async def add_favorite(part_id: str, user: dict = Depends(get_current_user)):
    """Save a part to favorites"""
    part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"favorites": part_id}})
    return {"status": "added", "part_id": part_id}

@api_router.delete("/favorites/{part_id}")
async def remove_favorite(part_id: str, user: dict = Depends(get_current_user)):
    """Remove a part from favorites"""
    await db.users.update_one({"id": user["id"]}, {"$pull": {"favorites": part_id}})
    return {"status": "removed", "part_id": part_id}

# ============== IMAGE UPLOAD ==============

UPLOAD_MAX_BYTES = 5 * 1024 * 1024

# Maps a validated Content-Type to the ONLY extension we'll ever write to disk.
# The extension must never be derived from the client-supplied filename --
# that was a path-traversal arbitrary-file-write vector (a crafted filename
# like "x.png/../../../backend/server.py" became the literal write path).
UPLOAD_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

def _sniff_image_signature(header: bytes, content_type: str) -> bool:
    """Verify the first bytes actually match the claimed image type.
    Content-Type is a client-supplied header and proves nothing on its own --
    without this, the allowlist check above can be trivially bypassed by
    lying about the header."""
    if content_type in ("image/jpeg", "image/jpg"):
        return header[:3] == b"\xff\xd8\xff"
    if content_type == "image/png":
        return header[:8] == b"\x89PNG\r\n\x1a\n"
    if content_type == "image/webp":
        return header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    return False

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload a part image. Returns the URL path."""
    if file.content_type not in UPLOAD_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    # Read in bounded chunks so an oversized upload is rejected as soon as it
    # crosses the limit, instead of being fully buffered into memory first.
    chunks = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > UPLOAD_MAX_BYTES:
            raise HTTPException(status_code=400, detail="Image must be under 5MB")
        chunks.append(chunk)
    contents = b"".join(chunks)

    if not _sniff_image_signature(contents[:12], file.content_type):
        raise HTTPException(status_code=400, detail="File content doesn't match a valid image")

    ext = UPLOAD_CONTENT_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = (UPLOAD_DIR / filename).resolve()
    if not filepath.is_relative_to(UPLOAD_DIR.resolve()):
        # Should be unreachable given `ext` is one of three hardcoded values
        # above -- kept as a last-line-of-defense assertion, not a real gate.
        raise HTTPException(status_code=400, detail="Invalid upload path")

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}", "filename": filename}

# ============== SPARE PARTS ROUTES ==============

@api_router.get("/parts")
async def search_parts(
    q: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    year: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    condition: Optional[str] = None,
    sort: str = "price_asc",
    page: int = 1,
    limit: int = 20
):
    query = {}

    if q:
        # Tokenize multi-word queries so word order / partial phrasing doesn't
        # cause misses, and expand each word with known synonyms (English /
        # French / pidgin) so "frein" matches parts listed as "brake" and
        # vice versa.
        words = [w for w in q.strip().split() if w]
        searchable_fields = ["name", "part_number", "description", "category", "brands", "models"]
        if words:
            query["$and"] = [
                {"$or": [
                    {field: {"$regex": re.escape(variant), "$options": "i"}}
                    for field in searchable_fields
                    for variant in expand_search_word(word)
                ]}
                for word in words
            ]

    if brand:
        query["brands"] = {"$in": [brand]}
    if model:
        query["models"] = {"$in": [model]}
    if year:
        query["years"] = {"$in": [year]}
    if category:
        query["category"] = category
    if condition:
        query["condition"] = condition

    # Exclude parts from deactivated sellers
    inactive_seller_ids = await db.sellers.distinct("id", {"active": False})
    if inactive_seller_ids:
        query["seller_id"] = {"$nin": inactive_seller_ids}

    # FIX: correct price range filter — build once, handle both bounds
    price_filter = {}
    if min_price is not None:  # FIX: use `is not None` so min_price=0 isn't skipped
        price_filter["$gte"] = min_price
    if max_price is not None:
        price_filter["$lte"] = max_price
    if price_filter:
        query["price"] = price_filter

    total = await db.parts.count_documents(query)
    skip = (page - 1) * limit

    if sort == "rating":
        # FIXED PROPERLY: parts don't store a rating themselves, but their seller
        # does. Join to sellers and sort by the seller's actual rating instead of
        # silently falling back to price, which was misleading users.
        pipeline = [
            {"$match": query},
            {"$lookup": {
                "from": "sellers",
                "localField": "seller_id",
                "foreignField": "id",
                "as": "seller_info"
            }},
            {"$unwind": {"path": "$seller_info", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {"_seller_rating": {"$ifNull": ["$seller_info.rating", 0]}}},
            {"$sort": {"_seller_rating": -1, "price": 1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {"_id": 0, "seller_info": 0, "_seller_rating": 0}}
        ]
        parts = await db.parts.aggregate(pipeline).to_list(limit)
    else:
        sort_options = {
            "price_asc": [("price", 1)],
            "price_desc": [("price", -1)],
            "newest": [("created_at", -1)],
        }
        sort_by = sort_options.get(sort, [("price", 1)])
        cursor = db.parts.find(query, {"_id": 0}).sort(sort_by).skip(skip).limit(limit)
        parts = await cursor.to_list(limit)

    seller_ids = list({p["seller_id"] for p in parts})
    sellers_map = {s["id"]: s async for s in db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})}

    for part in parts:
        seller = sellers_map.get(part["seller_id"])
        if seller:
            part["seller"] = {
                "id": seller["id"],
                "name": seller["name"],
                "rating": seller["rating"],
                "rating_count": seller.get("rating_count", 0),
                "sales_count": seller["sales_count"],
                "verified": seller["verified"],
                "whatsapp": seller["whatsapp"],
                "phone": seller["phone"]
            }

    return {"parts": parts, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/parts/{part_id}")
async def get_part(part_id: str, user: Optional[dict] = Depends(get_optional_user)):
    part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")

    seller = await db.sellers.find_one({"id": part["seller_id"]}, {"_id": 0})
    if seller:
        part["seller"] = seller

    similar_parts = await db.parts.find({
        "part_number": part["part_number"],
        "id": {"$ne": part_id}
    }, {"_id": 0}).to_list(10)

    sim_seller_ids = list({sp["seller_id"] for sp in similar_parts})
    sim_sellers_map = {s["id"]: s async for s in db.sellers.find({"id": {"$in": sim_seller_ids}}, {"_id": 0})}

    for sp in similar_parts:
        s = sim_sellers_map.get(sp["seller_id"])
        if s:
            sp["seller"] = {"id": s["id"], "name": s["name"], "rating": s["rating"],
                            "whatsapp": s["whatsapp"], "phone": s["phone"]}

    part["price_comparison"] = similar_parts

    # Attach favorite status if user is logged in
    if user:
        part["is_favorite"] = part_id in user.get("favorites", [])

    return part

# ============== SELLERS ROUTES ==============

@api_router.get("/sellers")
async def list_sellers(q: Optional[str] = None, page: int = 1, limit: int = 20):
    query = {"active": {"$ne": False}}  # exclude deactivated sellers from public listing
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}}
        ]
    skip = (page - 1) * limit
    sellers = await db.sellers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.sellers.count_documents(query)
    return {"sellers": sellers, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/sellers/{seller_id}")
async def get_seller(seller_id: str):
    seller = await db.sellers.find_one({"id": seller_id, "active": {"$ne": False}}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    parts = await db.parts.find({"seller_id": seller_id}, {"_id": 0}).to_list(100)
    seller["parts"] = parts
    return seller

# ============== PART REQUESTS ROUTES ==============

@api_router.get("/requests")
async def list_requests(status: Optional[str] = None, page: int = 1, limit: int = 20):
    query = {}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    requests = await db.requests.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.requests.count_documents(query)
    return {"requests": requests, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.post("/requests")
async def create_request(data: PartRequestCreate, user: dict = Depends(get_current_user)):
    request_obj = PartRequest(
        user_id=user["id"],
        user_contact=user.get("phone") or user.get("email") or "",
        user_name=user.get("name"),
        **data.model_dump()
    )
    request_dict = request_obj.model_dump()
    request_dict['created_at'] = request_dict['created_at'].isoformat()
    await db.requests.insert_one(request_dict)
    return {k: v for k, v in request_dict.items() if k != '_id'}

@api_router.get("/requests/{request_id}")
async def get_request(request_id: str):
    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@api_router.post("/requests/{request_id}/respond")
async def respond_to_request(request_id: str, response: RequestResponse, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Only sellers can respond to requests")

    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    seller = await db.sellers.find_one({"id": user["seller_id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=403, detail="Seller profile not found")

    response_data = {
        "seller_id": seller["id"],
        "seller_name": seller["name"],
        "seller_whatsapp": seller["whatsapp"],
        "price": response.price,
        "condition": response.condition,
        "message": response.message,
        "available": response.available,
        "responded_at": datetime.now(timezone.utc).isoformat()
    }

    await db.requests.update_one(
        {"id": request_id},
        {
            "$push": {"responses": response_data},
            "$set": {"status": "responded"}
        }
    )
    await touch_seller_activity(seller["id"])

    # Send WhatsApp notification via Twilio (optional)
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_wa_from = os.environ.get('TWILIO_WHATSAPP_NUMBER')  # e.g. whatsapp:+14155238886

    if twilio_sid and twilio_token and twilio_wa_from:
        try:
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(twilio_sid, twilio_token)
            requester_phone = request.get("user_contact")
            if requester_phone and requester_phone.startswith("+"):
                tc.messages.create(
                    body=(
                        f"🔧 AutoNexus: A seller has responded to your request for *{request['part_name']}*!\n\n"
                        f"Seller: {seller['name']}\n"
                        f"Price: {response.price:,} FCFA\n"
                        f"Message: {response.message}\n\n"
                        f"Contact seller on WhatsApp: {seller['whatsapp']}"
                    ),
                    from_=twilio_wa_from,
                    to=f"whatsapp:{requester_phone}"
                )
        except Exception as e:
            logging.error(f"WhatsApp notification failed: {e}")

    return {"status": "success", "response": response_data}

@api_router.post("/requests/{request_id}/accept")
async def accept_request_quote(request_id: str, seller_id: str, user: dict = Depends(get_current_user)):
    """Buyer accepts a seller's quote, closing the request and crediting the seller with a real sale."""
    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="This isn't your request")
    if request["status"] == "fulfilled":
        raise HTTPException(status_code=400, detail="This request has already been fulfilled")

    matching = next((r for r in request.get("responses", []) if r["seller_id"] == seller_id), None)
    if not matching:
        raise HTTPException(status_code=404, detail="That seller hasn't responded to this request")

    await db.requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "fulfilled",
            "accepted_seller_id": seller_id,
            "accepted_price": matching["price"]
        }}
    )
    await db.sellers.update_one({"id": seller_id}, {"$inc": {"sales_count": 1}})
    await touch_seller_activity(seller_id)

    return {"status": "fulfilled", "accepted_seller_id": seller_id, "accepted_price": matching["price"]}

@api_router.post("/sellers/{seller_id}/rate")
async def rate_seller(seller_id: str, data: RatingCreate, user: dict = Depends(get_current_user)):
    """Buyers can only rate a seller once per completed (accepted) request — this is what keeps
    ratings real instead of an admin-editable number."""
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    fulfilled_request = await db.requests.find_one({
        "user_id": user["id"],
        "accepted_seller_id": seller_id,
        "status": "fulfilled",
        "rated": {"$ne": True}
    }, {"_id": 0})

    if not fulfilled_request:
        raise HTTPException(
            status_code=403,
            detail="You can only rate a seller after accepting one of their quotes, and only once per deal"
        )

    rating_obj = Rating(
        seller_id=seller_id,
        user_id=user["id"],
        user_name=user.get("name"),
        request_id=fulfilled_request["id"],
        rating=data.rating,
        comment=data.comment
    )
    rating_dict = rating_obj.model_dump()
    rating_dict['created_at'] = rating_dict['created_at'].isoformat()
    await db.ratings.insert_one(rating_dict)

    await db.requests.update_one({"id": fulfilled_request["id"]}, {"$set": {"rated": True}})

    # Recompute the seller's live average rating from ALL their ratings — this
    # is what replaces the old manually-edited number.
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    prior_count = seller.get("rating_count", 0) if seller else 0
    prior_rating = seller.get("rating", 0) if seller else 0
    new_count = prior_count + 1
    new_avg = ((prior_rating * prior_count) + data.rating) / new_count

    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"rating": round(new_avg, 2), "rating_count": new_count}}
    )

    return {k: v for k, v in rating_dict.items() if k != '_id'}

@api_router.get("/sellers/{seller_id}/ratings")
async def get_seller_ratings(seller_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    ratings = await db.ratings.find({"seller_id": seller_id}, {"_id": 0}) \
        .sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.ratings.count_documents({"seller_id": seller_id})
    return {"ratings": ratings, "total": total, "page": page, "pages": (total + limit - 1) // limit}

# ============== SELLER DASHBOARD ROUTES ==============

@api_router.post("/seller/register")
async def register_seller(data: SellerCreate, user: dict = Depends(get_current_user)):
    if user["role"] == "seller":
        raise HTTPException(status_code=400, detail="Already registered as seller")

    existing_seller_id = user.get("seller_id")
    if existing_seller_id:
        existing = await db.sellers.find_one({"id": existing_seller_id}, {"_id": 0})
        if existing and existing.get("status") == "pending":
            raise HTTPException(status_code=400, detail="Your seller application is already pending admin approval")
        if existing and existing.get("status") == "approved":
            raise HTTPException(status_code=400, detail="Already registered as seller")
        # status == "rejected" (or missing record) -> allow re-apply below

    seller = Seller(**data.model_dump(), status="pending", verified=False)
    seller_dict = seller.model_dump()
    seller_dict['created_at'] = seller_dict['created_at'].isoformat()
    await db.sellers.insert_one(seller_dict)

    # Role stays "buyer" until an admin approves the application
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"seller_id": seller.id}}
    )
    return {k: v for k, v in seller_dict.items() if k != '_id'}

@api_router.get("/seller/application-status")
async def seller_application_status(user: dict = Depends(get_current_user)):
    if not user.get("seller_id"):
        return {"status": "none"}
    seller = await db.sellers.find_one({"id": user["seller_id"]}, {"_id": 0})
    if not seller:
        return {"status": "none"}
    return {"status": seller.get("status", "approved"), "seller": seller}

@api_router.get("/seller/profile")
async def get_seller_profile(user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    seller = await db.sellers.find_one({"id": user["seller_id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    return seller

@api_router.put("/seller/profile")
async def update_seller_profile(data: SellerUpdate, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        result = await db.sellers.update_one({"id": user["seller_id"]}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Seller profile not found")
    await touch_seller_activity(user["seller_id"])
    return await db.sellers.find_one({"id": user["seller_id"]}, {"_id": 0})

@api_router.get("/seller/parts")
async def get_seller_parts(user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    parts = await db.parts.find({"seller_id": user["seller_id"]}, {"_id": 0}).to_list(1000)
    return {"parts": parts}

@api_router.post("/seller/parts")
async def add_seller_part(data: SparePartCreate, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    part = SparePart(seller_id=user["seller_id"], **data.model_dump())
    part_dict = part.model_dump()
    part_dict['created_at'] = part_dict['created_at'].isoformat()
    await db.parts.insert_one(part_dict)
    await touch_seller_activity(user["seller_id"])
    return {k: v for k, v in part_dict.items() if k != '_id'}

@api_router.put("/seller/parts/{part_id}")
async def update_seller_part(part_id: str, data: SparePartUpdate, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    part = await db.parts.find_one({"id": part_id, "seller_id": user["seller_id"]}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.parts.update_one({"id": part_id}, {"$set": update_data})
    await touch_seller_activity(user["seller_id"])
    return await db.parts.find_one({"id": part_id}, {"_id": 0})

@api_router.delete("/seller/parts/{part_id}")
async def delete_seller_part(part_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    result = await db.parts.delete_one({"id": part_id, "seller_id": user["seller_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    await touch_seller_activity(user["seller_id"])
    return {"status": "deleted"}

@api_router.get("/seller/requests")
async def get_seller_requests(user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    requests = await db.requests.find({"status": "open"}, {"_id": 0}).sort([("created_at", -1)]).to_list(100)
    return {"requests": requests}

@api_router.get("/seller/catalog/pdf")
async def download_own_catalog(user: dict = Depends(get_current_user)):
    if user["role"] != "seller" or not user.get("seller_id"):
        raise HTTPException(status_code=403, detail="Not a seller")
    seller = await db.sellers.find_one({"id": user["seller_id"]}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller profile not found")
    parts = await db.parts.find({"seller_id": user["seller_id"]}, {"_id": 0}).to_list(2000)
    pdf_bytes = build_catalog_pdf(seller, parts)
    filename = f"{seller['name'].replace(' ', '_')}_catalog.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ============== ADMIN ROUTES ==============
# All routes below require the authenticated user to have is_admin=True.
# The very first admin must still be set manually in MongoDB (`is_admin: true`
# on their user document) since no admin exists yet to grant it. After that,
# any admin can promote/demote other users via GET/POST /admin/users below.

@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    """Quick dashboard counts for the admin overview."""
    total_sellers = await db.sellers.count_documents({})
    active_sellers = await db.sellers.count_documents({"active": {"$ne": False}})
    total_parts = await db.parts.count_documents({})
    total_requests = await db.requests.count_documents({})
    open_requests = await db.requests.count_documents({"status": "open"})
    total_users = await db.users.count_documents({})
    return {
        "total_sellers": total_sellers,
        "active_sellers": active_sellers,
        "deactivated_sellers": total_sellers - active_sellers,
        "total_parts": total_parts,
        "total_requests": total_requests,
        "open_requests": open_requests,
        "total_users": total_users,
    }

@api_router.get("/admin/users")
async def admin_list_users(
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    admin: dict = Depends(get_current_admin)
):
    """List all users so an admin can grant/revoke admin rights from the UI
    instead of needing direct database access."""
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}) \
        .sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.post("/admin/users/{user_id}/toggle-admin")
async def admin_toggle_admin(user_id: str, admin: dict = Depends(get_current_admin)):
    """Grant or revoke admin rights for any user. Guards against locking
    yourself out and against demoting the last remaining admin."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.get("is_admin"):
        if target["id"] == admin["id"]:
            raise HTTPException(status_code=400, detail="You can't revoke your own admin access")
        remaining_admins = await db.users.count_documents({"is_admin": True})
        if remaining_admins <= 1:
            raise HTTPException(status_code=400, detail="Can't remove the last remaining admin")
        await db.users.update_one({"id": user_id}, {"$set": {"is_admin": False}})
        return {"id": user_id, "is_admin": False}
    else:
        await db.users.update_one({"id": user_id}, {"$set": {"is_admin": True}})
        return {"id": user_id, "is_admin": True}

@api_router.get("/admin/sellers")
async def admin_list_sellers(
    q: Optional[str] = None,
    status: Optional[str] = None,  # "active" | "inactive" | None (all) — visibility status
    approval: Optional[str] = None,  # "pending" | "approved" | "rejected" | None (all)
    page: int = 1,
    limit: int = 50,
    admin: dict = Depends(get_current_admin)
):
    """List ALL sellers (including deactivated ones) for admin management."""
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    if status == "active":
        query["active"] = {"$ne": False}
    elif status == "inactive":
        query["active"] = False
    if approval in ("pending", "approved", "rejected"):
        query["status"] = approval

    skip = (page - 1) * limit
    sellers = await db.sellers.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)

    # Attach part counts so the admin can see inventory size at a glance
    for seller in sellers:
        seller["part_count"] = await db.parts.count_documents({"seller_id": seller["id"]})

    total = await db.sellers.count_documents(query)
    return {"sellers": sellers, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/admin/sellers/{seller_id}")
async def admin_get_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    parts = await db.parts.find({"seller_id": seller_id}, {"_id": 0}).to_list(1000)
    seller["parts"] = parts
    return seller

@api_router.post("/admin/sellers")
async def admin_create_seller(data: AdminSellerCreate, admin: dict = Depends(get_current_admin)):
    """Admin creates a seller directly (no application/approval needed, no user account required)."""
    seller = Seller(**data.model_dump(), status="approved")
    seller_dict = seller.model_dump()
    seller_dict['created_at'] = seller_dict['created_at'].isoformat()
    await db.sellers.insert_one(seller_dict)
    return {k: v for k, v in seller_dict.items() if k != '_id'}

@api_router.post("/admin/sellers/{seller_id}/approve")
async def admin_approve_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    """Approve a pending seller application. Promotes the linked user's role to 'seller'."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    await db.sellers.update_one({"id": seller_id}, {"$set": {"status": "approved"}})
    await db.users.update_many(
        {"seller_id": seller_id},
        {"$set": {"role": "seller"}}
    )
    return await db.sellers.find_one({"id": seller_id}, {"_id": 0})

@api_router.post("/admin/sellers/{seller_id}/reject")
async def admin_reject_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    """Reject a pending seller application. The applicant keeps their buyer account and may re-apply."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    await db.sellers.update_one({"id": seller_id}, {"$set": {"status": "rejected", "active": False}})
    return await db.sellers.find_one({"id": seller_id}, {"_id": 0})

@api_router.put("/admin/sellers/{seller_id}")
async def admin_update_seller(seller_id: str, data: AdminSellerUpdate, admin: dict = Depends(get_current_admin)):
    """Admin can edit ANY seller's profile — name, contact info, image, verified badge, rating, active status."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.sellers.update_one({"id": seller_id}, {"$set": update_data})
    return await db.sellers.find_one({"id": seller_id}, {"_id": 0})

@api_router.post("/admin/sellers/{seller_id}/deactivate")
async def admin_deactivate_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    """Hide a seller (and their parts) from public listings without deleting any data."""
    result = await db.sellers.update_one({"id": seller_id}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {"status": "deactivated", "seller_id": seller_id}

@api_router.post("/admin/sellers/{seller_id}/activate")
async def admin_activate_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    """Restore a previously deactivated seller to public listings."""
    result = await db.sellers.update_one({"id": seller_id}, {"$set": {"active": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {"status": "activated", "seller_id": seller_id}

@api_router.delete("/admin/sellers/{seller_id}")
async def admin_delete_seller(seller_id: str, admin: dict = Depends(get_current_admin)):
    """Permanently delete a seller, their parts, and unlink the associated user account.
    This cannot be undone — prefer deactivate for most cases."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    await db.parts.delete_many({"seller_id": seller_id})
    await db.sellers.delete_one({"id": seller_id})
    await db.users.update_many(
        {"seller_id": seller_id},
        {"$set": {"role": "buyer"}, "$unset": {"seller_id": ""}}
    )
    return {"status": "deleted", "seller_id": seller_id}

@api_router.get("/admin/sellers/{seller_id}/parts")
async def admin_get_seller_parts(seller_id: str, admin: dict = Depends(get_current_admin)):
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    parts = await db.parts.find({"seller_id": seller_id}, {"_id": 0}).to_list(2000)
    return {"parts": parts}

@api_router.post("/admin/sellers/{seller_id}/parts")
async def admin_add_seller_part(seller_id: str, data: SparePartCreate, admin: dict = Depends(get_current_admin)):
    """Admin adds a product on behalf of ANY seller, whether or not that seller has a linked user account."""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    part = SparePart(seller_id=seller_id, **data.model_dump())
    part_dict = part.model_dump()
    part_dict['created_at'] = part_dict['created_at'].isoformat()
    await db.parts.insert_one(part_dict)
    return {k: v for k, v in part_dict.items() if k != '_id'}

@api_router.put("/admin/sellers/{seller_id}/parts/{part_id}")
async def admin_update_seller_part(seller_id: str, part_id: str, data: SparePartUpdate, admin: dict = Depends(get_current_admin)):
    part = await db.parts.find_one({"id": part_id, "seller_id": seller_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.parts.update_one({"id": part_id}, {"$set": update_data})
    return await db.parts.find_one({"id": part_id}, {"_id": 0})

@api_router.delete("/admin/sellers/{seller_id}/parts/{part_id}")
async def admin_delete_seller_part(seller_id: str, part_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.parts.delete_one({"id": part_id, "seller_id": seller_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    return {"status": "deleted"}

@api_router.get("/admin/sellers/{seller_id}/catalog/pdf")
async def admin_download_seller_catalog(seller_id: str, admin: dict = Depends(get_current_admin)):
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    parts = await db.parts.find({"seller_id": seller_id}, {"_id": 0}).to_list(2000)
    pdf_bytes = build_catalog_pdf(seller, parts)
    filename = f"{seller['name'].replace(' ', '_')}_catalog.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@api_router.get("/admin/parts")
async def admin_list_parts(
    q: Optional[str] = None,
    seller_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    admin: dict = Depends(get_current_admin)
):
    """List ALL parts across every seller, including deactivated sellers' parts."""
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"part_number": {"$regex": q, "$options": "i"}},
        ]
    if seller_id:
        query["seller_id"] = seller_id
    skip = (page - 1) * limit
    parts = await db.parts.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.parts.count_documents(query)
    return {"parts": parts, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.delete("/admin/parts/{part_id}")
async def admin_delete_part(part_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.parts.delete_one({"id": part_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    return {"status": "deleted"}

@api_router.get("/admin/requests")
async def admin_list_requests(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    admin: dict = Depends(get_current_admin)
):
    """List ALL part requests for admin oversight."""
    query = {}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    requests = await db.requests.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.requests.count_documents(query)
    return {"requests": requests, "total": total, "page": page, "pages": (total + limit - 1) // limit}


# ============== FILTER OPTIONS ==============

@api_router.get("/filters/brands")
async def get_brands():
    return {"brands": ["Toyota", "Nissan", "Mitsubishi", "Suzuki", "Mazda", "Hyundai", "Kia", "Daewoo"]}

@api_router.get("/filters/categories")
async def get_categories():
    return {"categories": [
        "Engine Parts", "Brakes", "Suspension", "Electrical", "Filters",
        "Body Parts", "Transmission", "Cooling System", "Exhaust",
        "Interior", "Steering", "Fuel System"
    ]}

@api_router.get("/filters/models")
async def get_models(brand: Optional[str] = None):
    models_by_brand = {
        "Toyota": ["Corolla", "Camry", "RAV4", "Hilux", "Land Cruiser", "Prado", "Yaris", "Avensis"],
        "Nissan": ["Almera", "Sentra", "X-Trail", "Pathfinder", "Patrol", "Primera", "Note", "Maxima"],
        "Mitsubishi": ["Lancer", "Pajero", "Outlander", "L200", "Colt", "ASX", "Eclipse"],
        "Suzuki": ["Swift", "Vitara", "SX4", "Jimny", "Alto", "Celerio", "Baleno"],
        "Mazda": ["323", "626", "CX-5", "CX-7", "Demio", "Atenza", "Axela"],
        "Hyundai": ["Accent", "Elantra", "Sonata", "Tucson", "Santa Fe", "i10", "i20", "i30"],
        "Kia": ["Rio", "Cerato", "Optima", "Sportage", "Sorento", "Picanto", "Soul"],
        "Daewoo": ["Matiz", "Lanos", "Nubira", "Leganza", "Kalos", "Lacetti"]
    }
    if brand and brand in models_by_brand:
        return {"models": models_by_brand[brand]}
    all_models = []
    for models in models_by_brand.values():
        all_models.extend(models)
    return {"models": list(set(all_models))}

@api_router.get("/filters/years")
async def get_years():
    return {"years": [str(y) for y in range(2000, 2026)]}

# ============== ROOT & HEALTH ==============

@api_router.get("/")
async def root():
    return {"message": "AutoNexus API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# ============== LIGHTWEIGHT ANALYTICS ==============
# Simple event logging so there is real usage data (searches, WhatsApp contact
# clicks) instead of only anecdotal "early discussions show demand".
# Not tied to any user/auth — just counts what people actually do.

class AnalyticsEvent(BaseModel):
    event_type: str  # "search" | "whatsapp_click" | "seller_view" | "part_view"
    metadata: dict = {}

@api_router.post("/analytics/event")
async def log_event(event: AnalyticsEvent):
    await db.analytics_events.insert_one({
        "id": str(uuid.uuid4()),
        "event_type": event.event_type,
        "metadata": event.metadata,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "logged"}

@api_router.get("/analytics/summary")
async def analytics_summary(admin: dict = Depends(get_current_admin)):
    """Admin-only rollup: counts per event type, useful for gauging real demand."""
    pipeline = [{"$group": {"_id": "$event_type", "count": {"$sum": 1}}}]
    results = await db.analytics_events.aggregate(pipeline).to_list(100)
    return {r["_id"]: r["count"] for r in results}

app.include_router(api_router)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def create_indexes():
    # Data-hygiene pass for documents written before the /auth/signup fix:
    # a sparse index only excludes a document when the field is ABSENT, not
    # when it's stored as `null`, so any user created with only a phone (or
    # only an email) previously got the other field written as an explicit
    # null -- colliding with the next such user under the unique index below.
    # Unsetting the key restores real sparse behavior. Idempotent: matches
    # nothing once a database has been cleaned once.
    await db.users.update_many({"phone": None}, {"$unset": {"phone": ""}})
    await db.users.update_many({"email": None}, {"$unset": {"email": ""}})

    await db.users.create_index("id", unique=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.sellers.create_index("id", unique=True)
    await db.sellers.create_index([("name", 1)])
    await db.parts.create_index("id", unique=True)
    await db.parts.create_index("seller_id")
    await db.parts.create_index("part_number")
    await db.parts.create_index([("name", "text"), ("part_number", "text"), ("description", "text")])
    await db.parts.create_index([("brands", 1)])
    await db.parts.create_index([("models", 1)])
    await db.parts.create_index([("category", 1)])
    await db.parts.create_index([("price", 1)])
    await db.requests.create_index("id", unique=True)
    await db.requests.create_index("user_id")
    await db.requests.create_index([("status", 1), ("created_at", -1)])
    logger.info("MongoDB indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
