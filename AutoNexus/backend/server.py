from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
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

# Create the main app
app = FastAPI(title="AutoNexus API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ============== MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    phone: str
    name: Optional[str] = None
    role: str = "buyer"  # buyer or seller
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: Optional[str] = None

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
    image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SparePart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    part_number: str
    description: Optional[str] = None
    category: str
    brands: List[str]  # Compatible vehicle brands
    models: List[str]  # Compatible vehicle models
    years: List[str]   # Compatible years
    seller_id: str
    price: int  # Price in FCFA
    stock: int
    condition: str = "new"  # new or used
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
    urgency: str = "normal"  # urgent or normal
    location: str
    status: str = "open"  # open, responded, closed
    responses: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request/Response Models
class SellerCreate(BaseModel):
    name: str
    location: str
    description: Optional[str] = None
    phone: str
    whatsapp: str
    image: Optional[str] = None

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

# Store OTPs in memory (in production, use Redis)
otp_store = {}

def _purge_expired_otps():
    """Remove expired OTPs to prevent unbounded memory growth."""
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

# ============== AUTH ROUTES ==============

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to phone number (mock implementation)"""
    phone = request.phone
    # Validate phone format
    if not re.match(r'^\+237[0-9]{9}$', phone):
        raise HTTPException(status_code=400, detail="Invalid Cameroon phone number. Format: +237XXXXXXXXX")
    
    otp = generate_otp()
    _purge_expired_otps()
    otp_store[phone] = {
        "code": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    # In production, send OTP via Twilio SMS
    # For demo, we'll return the OTP (REMOVE IN PRODUCTION)
    logging.info(f"OTP for {phone}: {otp}")
    
    return {
        "status": "sent",
        "message": "OTP sent successfully"
    }

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify):
    """Verify OTP and return JWT token"""
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
    
    # Clear OTP after successful verification
    del otp_store[phone]
    
    # Check if user exists
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    
    if not user:
        # Create new user
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
            "seller_id": user.get("seller_id")
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user.get("name"),
        "role": user["role"],
        "seller_id": user.get("seller_id")
    }

@api_router.put("/auth/me")
async def update_me(data: UserUpdate, user: dict = Depends(get_current_user)):
    """Update current user profile"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return updated

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
    """Search spare parts with filters"""
    query = {}
    
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"part_number": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}}
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
    if min_price:
        query["price"] = {"$gte": min_price}
    if max_price:
        if "price" in query:
            query["price"]["$lte"] = max_price
        else:
            query["price"] = {"$lte": max_price}
    
    # Sorting
    sort_options = {
        "price_asc": [("price", 1)],
        "price_desc": [("price", -1)],
        "newest": [("created_at", -1)],
        "rating": [("seller_rating", -1)]
    }
    sort_by = sort_options.get(sort, [("price", 1)])
    
    skip = (page - 1) * limit
    
    cursor = db.parts.find(query, {"_id": 0}).sort(sort_by).skip(skip).limit(limit)
    parts = await cursor.to_list(limit)
    
    # Get total count
    total = await db.parts.count_documents(query)
    
    # Batch-fetch sellers to avoid N+1 queries
    seller_ids = list({p["seller_id"] for p in parts})
    sellers_cursor = db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})
    sellers_map = {s["id"]: s async for s in sellers_cursor}

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

    return {
        "parts": parts,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/parts/{part_id}")
async def get_part(part_id: str):
    """Get spare part details with price comparison"""
    part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    # Get seller info
    seller = await db.sellers.find_one({"id": part["seller_id"]}, {"_id": 0})
    if seller:
        part["seller"] = seller
    
    # Find similar parts from other sellers for price comparison
    similar_parts = await db.parts.find({
        "part_number": part["part_number"],
        "id": {"$ne": part_id}
    }, {"_id": 0}).to_list(10)
    
    # Batch-fetch sellers for similar parts
    sim_seller_ids = list({sp["seller_id"] for sp in similar_parts})
    sim_sellers_cursor = db.sellers.find({"id": {"$in": sim_seller_ids}}, {"_id": 0})
    sim_sellers_map = {s["id"]: s async for s in sim_sellers_cursor}

    for sp in similar_parts:
        s = sim_sellers_map.get(sp["seller_id"])
        if s:
            sp["seller"] = {
                "id": s["id"],
                "name": s["name"],
                "rating": s["rating"],
                "whatsapp": s["whatsapp"],
                "phone": s["phone"]
            }
    
    part["price_comparison"] = similar_parts
    
    return part

# ============== SELLERS ROUTES ==============

@api_router.get("/sellers")
async def list_sellers(
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """List all sellers"""
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    cursor = db.sellers.find(query, {"_id": 0}).skip(skip).limit(limit)
    sellers = await cursor.to_list(limit)
    total = await db.sellers.count_documents(query)
    
    return {
        "sellers": sellers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/sellers/{seller_id}")
async def get_seller(seller_id: str):
    """Get seller profile with their parts"""
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Get seller's parts
    parts = await db.parts.find({"seller_id": seller_id}, {"_id": 0}).to_list(100)
    seller["parts"] = parts
    
    return seller

# ============== PART REQUESTS ROUTES ==============

@api_router.get("/requests")
async def list_requests(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """List part requests (for sellers to view)"""
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    cursor = db.requests.find(query, {"_id": 0}).sort([("created_at", -1)]).skip(skip).limit(limit)
    requests = await cursor.to_list(limit)
    total = await db.requests.count_documents(query)
    
    return {
        "requests": requests,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.post("/requests")
async def create_request(data: PartRequestCreate, user: dict = Depends(get_current_user)):
    """Create a part request"""
    request_obj = PartRequest(
        user_id=user["id"],
        user_phone=user["phone"],
        user_name=user.get("name"),
        **data.model_dump()
    )
    request_dict = request_obj.model_dump()
    request_dict['created_at'] = request_dict['created_at'].isoformat()
    result = await db.requests.insert_one(request_dict)
    # Return clean dict without MongoDB ObjectId
    return {k: v for k, v in request_dict.items() if k != '_id'}

@api_router.get("/requests/{request_id}")
async def get_request(request_id: str):
    """Get request details"""
    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return request

@api_router.post("/requests/{request_id}/respond")
async def respond_to_request(request_id: str, response: RequestResponse, user: dict = Depends(get_current_user)):
    """Seller responds to a part request"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Only sellers can respond to requests")
    
    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get seller info
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
    
    return {"status": "success", "response": response_data}

# ============== SELLER DASHBOARD ROUTES ==============

@api_router.post("/seller/register")
async def register_seller(data: SellerCreate, user: dict = Depends(get_current_user)):
    """Register as a seller"""
    if user["role"] == "seller":
        raise HTTPException(status_code=400, detail="Already registered as seller")
    
    seller = Seller(**data.model_dump())
    seller_dict = seller.model_dump()
    seller_dict['created_at'] = seller_dict['created_at'].isoformat()
    result = await db.sellers.insert_one(seller_dict)
    
    # Update user role
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": "seller", "seller_id": seller.id}}
    )
    
    # Return clean dict without MongoDB ObjectId
    return {k: v for k, v in seller_dict.items() if k != '_id'}

@api_router.get("/seller/parts")
async def get_seller_parts(user: dict = Depends(get_current_user)):
    """Get seller's own parts"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    
    parts = await db.parts.find({"seller_id": user["seller_id"]}, {"_id": 0}).to_list(1000)
    return {"parts": parts}

@api_router.post("/seller/parts")
async def add_seller_part(data: SparePartCreate, user: dict = Depends(get_current_user)):
    """Add a new spare part"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    
    part = SparePart(seller_id=user["seller_id"], **data.model_dump())
    part_dict = part.model_dump()
    part_dict['created_at'] = part_dict['created_at'].isoformat()
    result = await db.parts.insert_one(part_dict)
    # Return clean dict without MongoDB ObjectId
    return {k: v for k, v in part_dict.items() if k != '_id'}

@api_router.put("/seller/parts/{part_id}")
async def update_seller_part(part_id: str, data: SparePartUpdate, user: dict = Depends(get_current_user)):
    """Update a spare part"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    
    part = await db.parts.find_one({"id": part_id, "seller_id": user["seller_id"]}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.parts.update_one({"id": part_id}, {"$set": update_data})
    
    updated = await db.parts.find_one({"id": part_id}, {"_id": 0})
    return updated

@api_router.delete("/seller/parts/{part_id}")
async def delete_seller_part(part_id: str, user: dict = Depends(get_current_user)):
    """Delete a spare part"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    
    result = await db.parts.delete_one({"id": part_id, "seller_id": user["seller_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    
    return {"status": "deleted"}

@api_router.get("/seller/requests")
async def get_seller_requests(user: dict = Depends(get_current_user)):
    """Get part requests for seller to respond"""
    if user["role"] != "seller":
        raise HTTPException(status_code=403, detail="Not a seller")
    
    requests = await db.requests.find({"status": "open"}, {"_id": 0}).sort([("created_at", -1)]).to_list(100)
    return {"requests": requests}

# ============== FILTER OPTIONS ==============

@api_router.get("/filters/brands")
async def get_brands():
    """Get available vehicle brands"""
    brands = ["Toyota", "Nissan", "Mitsubishi", "Suzuki", "Mazda", "Hyundai", "Kia", "Daewoo"]
    return {"brands": brands}

@api_router.get("/filters/categories")
async def get_categories():
    """Get part categories"""
    categories = [
        "Engine Parts",
        "Brakes",
        "Suspension",
        "Electrical",
        "Filters",
        "Body Parts",
        "Transmission",
        "Cooling System",
        "Exhaust",
        "Interior",
        "Steering",
        "Fuel System"
    ]
    return {"categories": categories}

@api_router.get("/filters/models")
async def get_models(brand: Optional[str] = None):
    """Get vehicle models for a brand"""
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
    
    # Return all models
    all_models = []
    for models in models_by_brand.values():
        all_models.extend(models)
    return {"models": list(set(all_models))}

@api_router.get("/filters/years")
async def get_years():
    """Get available years"""
    years = [str(y) for y in range(2000, 2026)]
    return {"years": years}

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample data"""
    # Check if already seeded
    existing = await db.sellers.count_documents({})
    if existing > 0:
        return {"status": "already_seeded", "sellers": existing}
    
    # Sample sellers
    sellers_data = [
        {
            "id": "seller-1",
            "name": "Akan Motor Parts",
            "location": "Camp Yabassi, Douala",
            "description": "Specializing in Japanese and Korean vehicle parts since 2010. Quality assured parts with warranty.",
            "phone": "+237677123456",
            "whatsapp": "+237677123456",
            "rating": 4.8,
            "sales_count": 1250,
            "verified": True,
            "image": "https://images.unsplash.com/photo-1550505095-81378a674395?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "seller-2",
            "name": "Camp Auto Parts",
            "location": "Camp Yabassi, Douala",
            "description": "Your one-stop shop for all car parts. New and quality used parts available.",
            "phone": "+237699234567",
            "whatsapp": "+237699234567",
            "rating": 4.5,
            "sales_count": 890,
            "verified": True,
            "image": "https://images.unsplash.com/photo-1644183230182-85bcf9b0ec5f?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "seller-3",
            "name": "Yabassi Spare Hub",
            "location": "Camp Yabassi, Douala",
            "description": "Wholesale and retail of automobile spare parts. Best prices guaranteed.",
            "phone": "+237655345678",
            "whatsapp": "+237655345678",
            "rating": 4.2,
            "sales_count": 650,
            "verified": True,
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "seller-4",
            "name": "Tokyo Auto Spares",
            "location": "Camp Yabassi, Douala",
            "description": "Direct import of genuine Japanese car parts. Specializing in Toyota and Nissan.",
            "phone": "+237688456789",
            "whatsapp": "+237688456789",
            "rating": 4.7,
            "sales_count": 1100,
            "verified": True,
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "seller-5",
            "name": "Korea Motors Parts",
            "location": "Camp Yabassi, Douala",
            "description": "Specialists in Hyundai and Kia parts. Fast delivery within Douala.",
            "phone": "+237666567890",
            "whatsapp": "+237666567890",
            "rating": 4.4,
            "sales_count": 780,
            "verified": True,
            "image": "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400"
        }
    ]
    
    # Sample parts
    parts_data = [
        # Suspension parts
        {
            "id": "part-1",
            "name": "Suspension Link (Stabilizer Bar)",
            "part_number": "K90666",
            "description": "Front stabilizer bar link for improved handling and stability",
            "category": "Suspension",
            "brands": ["Kia"],
            "models": ["Sportage"],
            "years": ["2011", "2012", "2013", "2014", "2015"],
            "seller_id": "seller-1",
            "price": 15000,
            "stock": 30,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-2",
            "name": "Suspension Link (Stabilizer Bar)",
            "part_number": "K90666",
            "description": "Front stabilizer bar link - quality aftermarket",
            "category": "Suspension",
            "brands": ["Kia"],
            "models": ["Sportage"],
            "years": ["2011", "2012", "2013", "2014", "2015"],
            "seller_id": "seller-2",
            "price": 16000,
            "stock": 40,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-3",
            "name": "Suspension Link (Stabilizer Bar)",
            "part_number": "K90666",
            "description": "Stabilizer bar link with 6 months warranty",
            "category": "Suspension",
            "brands": ["Kia"],
            "models": ["Sportage"],
            "years": ["2011", "2012", "2013", "2014", "2015"],
            "seller_id": "seller-3",
            "price": 17500,
            "stock": 18,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        # Brake parts
        {
            "id": "part-4",
            "name": "Brake Pads Set (Front)",
            "part_number": "BP-TY-001",
            "description": "Premium ceramic brake pads for smooth and quiet braking",
            "category": "Brakes",
            "brands": ["Toyota"],
            "models": ["Corolla", "Camry"],
            "years": ["2005", "2006", "2007", "2008", "2009", "2010"],
            "seller_id": "seller-1",
            "price": 12000,
            "stock": 50,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-5",
            "name": "Brake Pads Set (Front)",
            "part_number": "BP-TY-001",
            "description": "Quality brake pads - fits Corolla and Camry",
            "category": "Brakes",
            "brands": ["Toyota"],
            "models": ["Corolla", "Camry"],
            "years": ["2005", "2006", "2007", "2008", "2009", "2010"],
            "seller_id": "seller-4",
            "price": 11500,
            "stock": 35,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        # Filters
        {
            "id": "part-6",
            "name": "Oil Filter",
            "part_number": "OF-NS-002",
            "description": "High quality oil filter for Nissan vehicles",
            "category": "Filters",
            "brands": ["Nissan"],
            "models": ["Almera", "Sentra", "X-Trail"],
            "years": ["2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015"],
            "seller_id": "seller-2",
            "price": 3500,
            "stock": 100,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-7",
            "name": "Air Filter",
            "part_number": "AF-HY-003",
            "description": "Engine air filter for optimal performance",
            "category": "Filters",
            "brands": ["Hyundai"],
            "models": ["Accent", "Elantra"],
            "years": ["2010", "2011", "2012", "2013", "2014", "2015"],
            "seller_id": "seller-5",
            "price": 4500,
            "stock": 65,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        # Engine parts
        {
            "id": "part-8",
            "name": "Starter Motor",
            "part_number": "SM-TY-004",
            "description": "Rebuilt starter motor with 1 year warranty",
            "category": "Engine Parts",
            "brands": ["Toyota"],
            "models": ["Corolla"],
            "years": ["2005", "2006", "2007", "2008", "2009"],
            "seller_id": "seller-1",
            "price": 45000,
            "stock": 8,
            "condition": "used",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-9",
            "name": "Alternator",
            "part_number": "ALT-NS-005",
            "description": "New alternator for Nissan vehicles",
            "category": "Engine Parts",
            "brands": ["Nissan"],
            "models": ["Almera", "Primera"],
            "years": ["2006", "2007", "2008", "2009", "2010", "2011"],
            "seller_id": "seller-4",
            "price": 55000,
            "stock": 12,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        # More parts
        {
            "id": "part-10",
            "name": "Radiator",
            "part_number": "RAD-MT-006",
            "description": "Aluminum radiator for efficient cooling",
            "category": "Cooling System",
            "brands": ["Mitsubishi"],
            "models": ["Lancer", "Outlander"],
            "years": ["2008", "2009", "2010", "2011", "2012"],
            "seller_id": "seller-3",
            "price": 38000,
            "stock": 15,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-11",
            "name": "Battery 60Ah",
            "part_number": "BAT-60",
            "description": "Maintenance-free battery with 18 months warranty",
            "category": "Electrical",
            "brands": ["Toyota", "Nissan", "Hyundai", "Kia"],
            "models": ["Corolla", "Almera", "Accent", "Rio"],
            "years": ["2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020"],
            "seller_id": "seller-2",
            "price": 30000,
            "stock": 25,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1767990495521-95cceb571125?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-12",
            "name": "Fuel Pump",
            "part_number": "FP-SZ-007",
            "description": "Electric fuel pump assembly",
            "category": "Fuel System",
            "brands": ["Suzuki"],
            "models": ["Swift", "Vitara"],
            "years": ["2008", "2009", "2010", "2011", "2012", "2013", "2014"],
            "seller_id": "seller-3",
            "price": 28000,
            "stock": 20,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-13",
            "name": "Shock Absorber (Front)",
            "part_number": "SA-MZ-008",
            "description": "Gas-filled shock absorber for smooth ride",
            "category": "Suspension",
            "brands": ["Mazda"],
            "models": ["323", "626"],
            "years": ["2002", "2003", "2004", "2005", "2006", "2007"],
            "seller_id": "seller-1",
            "price": 22000,
            "stock": 18,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-14",
            "name": "Timing Belt Kit",
            "part_number": "TB-DW-009",
            "description": "Complete timing belt kit with tensioner and water pump",
            "category": "Engine Parts",
            "brands": ["Daewoo"],
            "models": ["Matiz", "Lanos", "Nubira"],
            "years": ["2000", "2001", "2002", "2003", "2004", "2005"],
            "seller_id": "seller-5",
            "price": 35000,
            "stock": 10,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"
        },
        {
            "id": "part-15",
            "name": "Headlight Assembly (Left)",
            "part_number": "HL-KI-010",
            "description": "OEM style headlight assembly",
            "category": "Body Parts",
            "brands": ["Kia"],
            "models": ["Cerato", "Optima"],
            "years": ["2012", "2013", "2014", "2015", "2016"],
            "seller_id": "seller-5",
            "price": 42000,
            "stock": 6,
            "condition": "new",
            "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"
        }
    ]
    
    # Insert sellers
    for seller in sellers_data:
        seller['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.sellers.insert_one(seller)
    
    # Insert parts
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

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def create_indexes():
    """Create MongoDB indexes for performance."""
    # users
    await db.users.create_index("id", unique=True)
    await db.users.create_index("phone", unique=True)
    # sellers
    await db.sellers.create_index("id", unique=True)
    await db.sellers.create_index([("name", 1)])
    await db.sellers.create_index([("location", 1)])
    # parts
    await db.parts.create_index("id", unique=True)
    await db.parts.create_index("seller_id")
    await db.parts.create_index("part_number")
    await db.parts.create_index([("name", "text"), ("part_number", "text"), ("description", "text")])
    await db.parts.create_index([("brands", 1)])
    await db.parts.create_index([("models", 1)])
    await db.parts.create_index([("category", 1)])
    await db.parts.create_index([("price", 1)])
    await db.parts.create_index([("condition", 1)])
    # requests
    await db.requests.create_index("id", unique=True)
    await db.requests.create_index("user_id")
    await db.requests.create_index([("status", 1), ("created_at", -1)])
    logger.info("MongoDB indexes created")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
