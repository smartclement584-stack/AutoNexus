"""
One-off helper to load demo sellers and parts for local development or a
fresh staging environment. Run this manually from the backend folder:

    py seed_demo_data.py

This is intentionally NOT an HTTP endpoint. Seeding is a data-provisioning
action, not a runtime API concern — it should never be reachable by an
unauthenticated (or any) network request. If you need to reseed after a
reset, run:

    py reset_db.py --full
    py seed_demo_data.py

Safe to run more than once: it no-ops if sellers already exist, same as the
old /api/seed endpoint did — the difference is this can now only be
triggered by someone with shell access to the server, not by anyone on the
internet.
"""
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

SELLERS_DATA = [
    {"id": "seller-1", "name": "Akan Motor Parts", "location": "Camp Yabassi, Douala",
     "description": "Specializing in Japanese and Korean vehicle parts since 2010. Quality assured parts with warranty.",
     "phone": "+237677123456", "whatsapp": "+237677123456", "rating": 4.8, "rating_count": 60, "sales_count": 1250, "verified": True, "status": "approved",
     "image": "https://images.unsplash.com/photo-1550505095-81378a674395?auto=format&fit=crop&q=80&w=400"},
    {"id": "seller-2", "name": "Camp Auto Parts", "location": "Camp Yabassi, Douala",
     "description": "Your one-stop shop for all car parts. New and quality used parts available.",
     "phone": "+237699234567", "whatsapp": "+237699234567", "rating": 4.5, "rating_count": 45, "sales_count": 890, "verified": True, "status": "approved",
     "image": "https://images.unsplash.com/photo-1644183230182-85bcf9b0ec5f?auto=format&fit=crop&q=80&w=400"},
    {"id": "seller-3", "name": "Yabassi Spare Hub", "location": "Camp Yabassi, Douala",
     "description": "Wholesale and retail of automobile spare parts. Best prices guaranteed.",
     "phone": "+237655345678", "whatsapp": "+237655345678", "rating": 4.2, "rating_count": 30, "sales_count": 650, "verified": True, "status": "approved",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "seller-4", "name": "Tokyo Auto Spares", "location": "Camp Yabassi, Douala",
     "description": "Direct import of genuine Japanese car parts. Specializing in Toyota and Nissan.",
     "phone": "+237688456789", "whatsapp": "+237688456789", "rating": 4.7, "rating_count": 55, "sales_count": 1100, "verified": True, "status": "approved",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "seller-5", "name": "Korea Motors Parts", "location": "Camp Yabassi, Douala",
     "description": "Specialists in Hyundai and Kia parts. Fast delivery within Douala.",
     "phone": "+237666567890", "whatsapp": "+237666567890", "rating": 4.4, "rating_count": 38, "sales_count": 780, "verified": True, "status": "approved",
     "image": "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400"},
]

PARTS_DATA = [
    {"id": "part-1", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
     "description": "Front stabilizer bar link for improved handling and stability",
     "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
     "years": ["2011", "2012", "2013", "2014", "2015"], "seller_id": "seller-1",
     "price": 15000, "stock": 30, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-2", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
     "description": "Front stabilizer bar link - quality aftermarket",
     "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
     "years": ["2011", "2012", "2013", "2014", "2015"], "seller_id": "seller-2",
     "price": 16000, "stock": 40, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-3", "name": "Suspension Link (Stabilizer Bar)", "part_number": "K90666",
     "description": "Stabilizer bar link with 6 months warranty",
     "category": "Suspension", "brands": ["Kia"], "models": ["Sportage"],
     "years": ["2011", "2012", "2013", "2014", "2015"], "seller_id": "seller-3",
     "price": 17500, "stock": 18, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-4", "name": "Brake Pads Set (Front)", "part_number": "BP-TY-001",
     "description": "Premium ceramic brake pads for smooth and quiet braking",
     "category": "Brakes", "brands": ["Toyota"], "models": ["Corolla", "Camry"],
     "years": ["2005", "2006", "2007", "2008", "2009", "2010"], "seller_id": "seller-1",
     "price": 12000, "stock": 50, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-5", "name": "Brake Pads Set (Front)", "part_number": "BP-TY-001",
     "description": "Quality brake pads - fits Corolla and Camry",
     "category": "Brakes", "brands": ["Toyota"], "models": ["Corolla", "Camry"],
     "years": ["2005", "2006", "2007", "2008", "2009", "2010"], "seller_id": "seller-4",
     "price": 11500, "stock": 35, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-6", "name": "Oil Filter", "part_number": "OF-NS-002",
     "description": "High quality oil filter for Nissan vehicles",
     "category": "Filters", "brands": ["Nissan"], "models": ["Almera", "Sentra", "X-Trail"],
     "years": ["2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015"], "seller_id": "seller-2",
     "price": 3500, "stock": 100, "condition": "new",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-7", "name": "Air Filter", "part_number": "AF-HY-003",
     "description": "Engine air filter for optimal performance",
     "category": "Filters", "brands": ["Hyundai"], "models": ["Accent", "Elantra"],
     "years": ["2010", "2011", "2012", "2013", "2014", "2015"], "seller_id": "seller-5",
     "price": 4500, "stock": 65, "condition": "new",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-8", "name": "Starter Motor", "part_number": "SM-TY-004",
     "description": "Rebuilt starter motor with 1 year warranty",
     "category": "Engine Parts", "brands": ["Toyota"], "models": ["Corolla"],
     "years": ["2005", "2006", "2007", "2008", "2009"], "seller_id": "seller-1",
     "price": 45000, "stock": 8, "condition": "used",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-9", "name": "Alternator", "part_number": "ALT-NS-005",
     "description": "New alternator for Nissan vehicles",
     "category": "Engine Parts", "brands": ["Nissan"], "models": ["Almera", "Primera"],
     "years": ["2006", "2007", "2008", "2009", "2010", "2011"], "seller_id": "seller-4",
     "price": 55000, "stock": 12, "condition": "new",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-10", "name": "Radiator", "part_number": "RAD-MT-006",
     "description": "Aluminum radiator for efficient cooling",
     "category": "Cooling System", "brands": ["Mitsubishi"], "models": ["Lancer", "Outlander"],
     "years": ["2008", "2009", "2010", "2011", "2012"], "seller_id": "seller-3",
     "price": 38000, "stock": 15, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-11", "name": "Battery 60Ah", "part_number": "BAT-60",
     "description": "Maintenance-free battery with 18 months warranty",
     "category": "Electrical", "brands": ["Toyota", "Nissan", "Hyundai", "Kia"],
     "models": ["Corolla", "Almera", "Accent", "Rio"],
     "years": ["2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020"],
     "seller_id": "seller-2", "price": 30000, "stock": 25, "condition": "new",
     "image": "https://images.unsplash.com/photo-1767990495521-95cceb571125?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-12", "name": "Fuel Pump", "part_number": "FP-SZ-007",
     "description": "Electric fuel pump assembly",
     "category": "Fuel System", "brands": ["Suzuki"], "models": ["Swift", "Vitara"],
     "years": ["2008", "2009", "2010", "2011", "2012", "2013", "2014"], "seller_id": "seller-3",
     "price": 28000, "stock": 20, "condition": "new",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-13", "name": "Shock Absorber (Front)", "part_number": "SA-MZ-008",
     "description": "Gas-filled shock absorber for smooth ride",
     "category": "Suspension", "brands": ["Mazda"], "models": ["323", "626"],
     "years": ["2002", "2003", "2004", "2005", "2006", "2007"], "seller_id": "seller-1",
     "price": 22000, "stock": 18, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-14", "name": "Timing Belt Kit", "part_number": "TB-DW-009",
     "description": "Complete timing belt kit with tensioner and water pump",
     "category": "Engine Parts", "brands": ["Daewoo"], "models": ["Matiz", "Lanos", "Nubira"],
     "years": ["2000", "2001", "2002", "2003", "2004", "2005"], "seller_id": "seller-5",
     "price": 35000, "stock": 10, "condition": "new",
     "image": "https://images.unsplash.com/photo-1656597631995-9fa0e1072279?auto=format&fit=crop&q=80&w=400"},
    {"id": "part-15", "name": "Headlight Assembly (Left)", "part_number": "HL-KI-010",
     "description": "OEM style headlight assembly",
     "category": "Body Parts", "brands": ["Kia"], "models": ["Cerato", "Optima"],
     "years": ["2012", "2013", "2014", "2015", "2016"], "seller_id": "seller-5",
     "price": 42000, "stock": 6, "condition": "new",
     "image": "https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&q=80&w=400"},
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    existing = await db.sellers.count_documents({})
    if existing > 0:
        print(f"Already seeded ({existing} sellers exist) — nothing to do.")
        print("Run `py reset_db.py --full` first if you want a totally clean slate.")
        return

    for seller in SELLERS_DATA:
        seller["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.sellers.insert_one(seller)
    for part in PARTS_DATA:
        part["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.parts.insert_one(part)

    print(f"Seeded {len(SELLERS_DATA)} sellers and {len(PARTS_DATA)} parts.")


if __name__ == "__main__":
    asyncio.run(main())
