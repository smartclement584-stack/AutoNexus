"""
Grant admin rights to a user by phone or email. Run from the backend folder
AFTER signing up in the app:

    py make_admin.py +237XXXXXXXXX
    py make_admin.py you@example.com

Only needed for the very first admin — after that, any admin can promote
other users from the Admin Panel UI.
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()


async def main():
    if len(sys.argv) < 2:
        print("Usage: py make_admin.py <phone_or_email>")
        return

    identifier = sys.argv[1]
    query = {"email": identifier.lower()} if "@" in identifier else {"phone": identifier}

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    result = await db.users.update_one(query, {"$set": {"is_admin": True}})

    if result.matched_count == 0:
        print(f"No user found matching: {identifier}")
        print("Did you sign up first? Check the exact phone/email you used.")
    else:
        print(f"Done! {identifier} is now an admin. Log out and back in to see the Admin Panel.")


asyncio.run(main())
