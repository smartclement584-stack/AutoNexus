from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import shutil
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import random
import re

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

# Image upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="AutoNexus API", version="1.0.0")

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
    phone: str
    name: Optional[str] = None
    role: str = "buyer"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: Optional[str] = None
    favorites: List[str] = []  # list of part IDs
    is_admin: bool = False

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    code: str

class Seller(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    rating: float = 4.5
    sales_count: int = 0
    verified: bool = True
    active: bool = True
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
    user_phone: str
    user_name: Optional[str] = None
    vehicle_brand: str
    vehicle_model: str
    vehicle_year: str
    part_name: str
    description: Optional[str] = None
    urgency: str = "normal"
    location: str
    status: str = "open"
    responses: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SellerCreate(BaseModel):
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    image: Optional[str] = None

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
    rating: Optional[float] = None

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

otp_store = {}

def _purge_expired_otps():
    now = datetime.now(timezone.utc)
    expired = [phone for phone, data in otp_store.items() if now > data["expires"]]
    for phone in expired:
        del otp_store[phone]

def generate_otp():
    return str(random.randint(100000, 999999))

def create_token(user_id: str, phone: str, role: str):
    payload = {
        "user_id": user_id,
        "phone": phone,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
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
        return user
    except:
        return None

async def get_current_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    phone = request.phone
    if not re.match(r'^\+237[0-9]{9}$', phone):
        raise HTTPException(status_code=400, detail="Invalid Cameroon phone number. Format: +237XXXXXXXXX")

    otp = generate_otp()
    _purge_expired_otps()
    otp_store[phone] = {
        "code": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10)
    }

    # Twilio SMS integration
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_from = os.environ.get('TWILIO_PHONE_NUMBER')
    sms_sent = False

    if twilio_sid and twilio_token and twilio_from:
        try:
            from twilio.rest import Client as TwilioClient
            twilio_client = TwilioClient(twilio_sid, twilio_token)
            twilio_client.messages.create(
                body=f"Your AutoNexus verification code is: {otp}. Valid for 10 minutes.",
                from_=twilio_from,
                to=phone
            )
            sms_sent = True
            logging.info(f"SMS sent to {phone}")
        except Exception as e:
            logging.error(f"Twilio SMS failed: {e}")

    logging.info(f"OTP for {phone}: {otp}")

    response = {"status": "sent", "message": "OTP sent successfully"}
    # FIX: In demo mode (no Twilio), return the OTP so users can actually log in
    if not sms_sent:
        response["demo_otp"] = otp
        response["demo_note"] = "Demo mode: no SMS sent. Use this code to login."

    return response

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify):
    phone = request.phone
    code = request.code

    stored = otp_store.get(phone)
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP found for this number")

    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_store[phone]
        raise HTTPException(status_code=400, detail="OTP expired")

    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    del otp_store[phone]

    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        new_user = User(phone=phone)
        user_dict = new_user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
        user = user_dict

    token = create_token(user["id"], user["phone"], user["role"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "name": user.get("name"),
            "role": user["role"],
            "seller_id": user.get("seller_id"),
            "is_admin": user.get("is_admin", False)
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user.get("name"),
        "role": user["role"],
        "seller_id": user.get("seller_id"),
        "favorites": user.get("favorites", []),
        "is_admin": user.get("is_admin", False)
    }

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

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload a part image. Returns the URL path."""
    # Validate type
    allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    # Validate size (5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename

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
        # IMPROVED: tokenize multi-word queries so word order / partial phrasing
        # doesn't cause misses (e.g. "corolla brake" now matches a part named
        # "Brake Pads Set" with brand "Toyota"/model "Corolla" even though that
        # exact phrase never appears together in any single field).
        words = [w for w in q.strip().split() if w]
        searchable_fields = ["name", "part_number", "description", "category", "brands", "models"]
        if words:
            query["$and"] = [
                {"$or": [{field: {"$regex": re.escape(word), "$options": "i"}} for field in searchable_fields]}
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
        user_phone=user["phone"],
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

    # Send WhatsApp notification via Twilio (optional)
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_wa_from = os.environ.get('TWILIO_WHATSAPP_NUMBER')  # e.g. whatsapp:+14155238886

    if twilio_sid and twilio_token and twilio_wa_from:
        try:
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(twilio_sid, twilio_token)
            requester_phone = request.get("user_phone")
            if requester_phone:
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

# ============== SELLER DASHBOARD ROUTES ==============

@api_router.post("/seller/register")
async def register_seller(data: SellerCreate, user: dict = Depends(get_current_user)):
    if user["role"] == "seller":
        raise HTTPException(status_code=400, detail="Already registered as seller")

    seller = Seller(**data.model_dump())
    seller_dict = seller.model_dump()
    seller_dict['created_at'] = seller_dict['created_at'].isoformat()
    await db.sellers.insert_one(seller_dict)

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": "seller", "seller_id": seller.id}}
    )
    return {k: v for k, v in seller_dict.items() if k != '_id'}

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
    return await db.parts.find_one({"id": part_id}, {"_id": 0})

@api_router.delete("/seller/parts/{part_id}")
async def delete_seller_part(part_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    result = await db.parts.delete_one({"id": part_id, "seller_id": user["seller_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    return {"status": "deleted"}

@api_router.get("/seller/requests")
async def get_seller_requests(user: dict = Depends(get_current_user)):
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    requests = await db.requests.find({"status": "open"}, {"_id": 0}).sort([("created_at", -1)]).to_list(100)
    return {"requests": requests}

# ============== ADMIN ROUTES ==============
# All routes below require the authenticated user to have is_admin=True.
# To make a user an admin, manually set `is_admin: true` on their document
# in the `users` collection in MongoDB (e.g. via mongosh or MongoDB Compass).

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

@api_router.get("/admin/sellers")
async def admin_list_sellers(
    q: Optional[str] = None,
    status: Optional[str] = None,  # "active" | "inactive" | None (all)
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

@api_router.get("/admin/users")
async def admin_list_users(q: Optional[str] = None, page: int = 1, limit: int = 50, admin: dict = Depends(get_current_admin)):
    """List all registered users (buyers + sellers + admins)."""
    query = {}
    if q:
        query["$or"] = [
            {"phone": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}

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

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    existing = await db.sellers.count_documents({})
    if existing > 0:
        return {"status": "already_seeded", "sellers": existing}

    sellers_data = [
        {"id": "seller-1", "name": "Akan Motor Parts", "location": "Camp Yabassi, Douala",
         "description": "Specializing in Japanese and Korean vehicle parts since 2010. Quality assured parts with warranty.",
         "phone": "+237677123456", "whatsapp": "+237677123456", "rating": 4.8, "sales_count": 1250, "verified": True,
         "image": "https://images.unsplash.com/photo-1550505095-81378a674395?auto=format&fit=crop&q=80&w=400"},
        {"id": "seller-2", "name": "Camp Auto Parts", "location": "Camp Yabassi, Douala",
         "description": "Your one-stop shop for all car parts. New and quality used parts available.",
         "phone": "+237699234567", "whatsapp": "+237699234567", "rating": 4.5, "sales_count": 890, "verified": True,
         "image": "https://images.unsplash.com/photo-1644183230182-85bcf9b0ec5f?auto=format&fit=crop&q=80&w=400"},
        {"id": "seller-3", "name": "Yabassi Spare Hub", "location": "Camp Yabassi, Douala",
         "description": "Wholesale and retail of automobile spare parts. Best prices guaranteed.",
         "phone": "+237655345678", "whatsapp": "+237655345678", "rating": 4.2, "sales_count": 650, "verified": True,
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "seller-4", "name": "Tokyo Auto Spares", "location": "Camp Yabassi, Douala",
         "description": "Direct import of genuine Japanese car parts. Specializing in Toyota and Nissan.",
         "phone": "+237688456789", "whatsapp": "+237688456789", "rating": 4.7, "sales_count": 1100, "verified": True,
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "seller-5", "name": "Korea Motors Parts", "location": "Camp Yabassi, Douala",
         "description": "Specialists in Hyundai and Kia parts. Fast delivery within Douala.",
         "phone": "+237666567890", "whatsapp": "+237666567890", "rating": 4.4, "sales_count": 780, "verified": True,
         "image": "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400"},
    ]

    parts_data = [
        {"id": "part-1", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
         "description": "Front stabilizer bar link for improved handling and stability",
         "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
         "years": ["2011","2012","2013","2014","2015"], "seller_id": "seller-1",
         "price": 15000, "stock": 30, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-2", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
         "description": "Front stabilizer bar link - quality aftermarket",
         "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
         "years": ["2011","2012","2013","2014","2015"], "seller_id": "seller-2",
         "price": 16000, "stock": 40, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-3", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
         "description": "Stabilizer bar link with 6 months warranty",
         "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
         "years": ["2011","2012","2013","2014","2015"], "seller_id": "seller-3",
         "price": 17500, "stock": 18, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-4", "name": "Brake Pads Set (Front)", "part_number": "BP-TY-001",
         "description": "Premium ceramic brake pads for smooth and quiet braking",
         "category": "Brakes", "brands": ["Toyota"], "models": ["Corolla","Camry"],
         "years": ["2005","2006","2007","2008","2009","2010"], "seller_id": "seller-1",
         "price": 12000, "stock": 50, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-5", "name": "Brake Pads Set (Front)", "part_number": "BP-TY-001",
         "description": "Quality brake pads - fits Corolla and Camry",
         "category": "Brakes", "brands": ["Toyota"], "models": ["Corolla","Camry"],
         "years": ["2005","2006","2007","2008","2009","2010"], "seller_id": "seller-4",
         "price": 11500, "stock": 35, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-6", "name": "Oil Filter", "part_number": "OF-NS-002",
         "description": "High quality oil filter for Nissan vehicles",
         "category": "Filters", "brands": ["Nissan"], "models": ["Almera","Sentra","X-Trail"],
         "years": ["2008","2009","2010","2011","2012","2013","2014","2015"], "seller_id": "seller-2",
         "price": 3500, "stock": 100, "condition": "new",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-7", "name": "Air Filter", "part_number": "AF-HY-003",
         "description": "Engine air filter for optimal performance",
         "category": "Filters", "brands": ["Hyundai"], "models": ["Accent","Elantra"],
         "years": ["2010","2011","2012","2013","2014","2015"], "seller_id": "seller-5",
         "price": 4500, "stock": 65, "condition": "new",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-8", "name": "Starter Motor", "part_number": "SM-TY-004",
         "description": "Rebuilt starter motor with 1 year warranty",
         "category": "Engine Parts", "brands": ["Toyota"], "models": ["Corolla"],
         "years": ["2005","2006","2007","2008","2009"], "seller_id": "seller-1",
         "price": 45000, "stock": 8, "condition": "used",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-9", "name": "Alternator", "part_number": "ALT-NS-005",
         "description": "New alternator for Nissan vehicles",
         "category": "Engine Parts", "brands": ["Nissan"], "models": ["Almera","Primera"],
         "years": ["2006","2007","2008","2009","2010","2011"], "seller_id": "seller-4",
         "price": 55000, "stock": 12, "condition": "new",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-10", "name": "Radiator", "part_number": "RAD-MT-006",
         "description": "Aluminum radiator for efficient cooling",
         "category": "Cooling System", "brands": ["Mitsubishi"], "models": ["Lancer","Outlander"],
         "years": ["2008","2009","2010","2011","2012"], "seller_id": "seller-3",
         "price": 38000, "stock": 15, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-11", "name": "Battery 60Ah", "part_number": "BAT-60",
         "description": "Maintenance-free battery with 18 months warranty",
         "category": "Electrical", "brands": ["Toyota","Nissan","Hyundai","Kia"],
         "models": ["Corolla","Almera","Accent","Rio"],
         "years": ["2010","2011","2012","2013","2014","2015","2016","2017","2018","2019","2020"],
         "seller_id": "seller-2", "price": 30000, "stock": 25, "condition": "new",
         "image": "https://images.unsplash.com/photo-1767990495521-95cceb571125?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-12", "name": "Fuel Pump", "part_number": "FP-SZ-007",
         "description": "Electric fuel pump assembly",
         "category": "Fuel System", "brands": ["Suzuki"], "models": ["Swift","Vitara"],
         "years": ["2008","2009","2010","2011","2012","2013","2014"], "seller_id": "seller-3",
         "price": 28000, "stock": 20, "condition": "new",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-13", "name": "Shock Absorber (Front)", "part_number": "SA-MZ-008",
         "description": "Gas-filled shock absorber for smooth ride",
         "category": "Suspension", "brands": ["Mazda"], "models": ["323","626"],
         "years": ["2002","2003","2004","2005","2006","2007"], "seller_id": "seller-1",
         "price": 22000, "stock": 18, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-14", "name": "Timing Belt Kit", "part_number": "TB-DW-009",
         "description": "Complete timing belt kit with tensioner and water pump",
         "category": "Engine Parts", "brands": ["Daewoo"], "models": ["Matiz","Lanos","Nubira"],
         "years": ["2000","2001","2002","2003","2004","2005"], "seller_id": "seller-5",
         "price": 35000, "stock": 10, "condition": "new",
         "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
        {"id": "part-15", "name": "Headlight Assembly (Left)", "part_number": "HL-KI-010",
         "description": "OEM style headlight assembly",
         "category": "Body Parts", "brands": ["Kia"], "models": ["Cerato","Optima"],
         "years": ["2012","2013","2014","2015","2016"], "seller_id": "seller-5",
         "price": 42000, "stock": 6, "condition": "new",
         "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    ]

    for seller in sellers_data:
        seller['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.sellers.insert_one(seller)
    for part in parts_data:
        part['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.parts.insert_one(part)

    return {"status": "seeded", "sellers": len(sellers_data), "parts": len(parts_data)}

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
    await db.users.create_index("id", unique=True)
    await db.users.create_index("phone", unique=True)
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
