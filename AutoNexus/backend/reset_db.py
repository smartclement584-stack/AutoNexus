"""
One-off helper to reset AutoNexus collections after the auth + ratings + approval
schema changes. Run this ONCE from the backend folder:

    py reset_db.py

What it does:
  - Drops the old `users` collection (old OTP accounts have no password_hash and
    can't log in under the new password system anyway).
  - Drops the old `sellers` indexes that conflict with the new sparse/unique ones.
  - Leaves your parts/requests alone unless you pass --full.

Pass --full to also wipe sellers, parts, requests, and ratings for a totally
clean slate (useful while still in development):

    py reset_db.py --full
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()


async def main():
    full = "--full" in sys.argv
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Drop the users collection (removes conflicting indexes + old OTP accounts)
    await db.users.drop()
    print("Dropped users collection (old accounts + conflicting phone index).")

    if full:
        for coll in ["sellers", "parts", "requests", "ratings"]:
            await db[coll].drop()
            print(f"Dropped {coll} collection.")
        print("\nFull reset done. Run `py seed_demo_data.py` to reload demo sellers/parts.")
    else:
        # Just clear conflicting indexes on sellers so startup can recreate them
        try:
            await db.sellers.drop_indexes()
            print("Dropped sellers indexes (will be recreated on startup).")
        except Exception as e:
            print(f"(sellers index drop skipped: {e})")
        print("\nDone. Restart the server now.")

    print("\nReminder: sign up fresh, then run  py make_admin.py <your_phone_or_email>")


asyncio.run(main())
