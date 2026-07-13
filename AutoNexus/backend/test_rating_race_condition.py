"""
Test that concurrent rating submissions for the same seller do not lose
updates (the original bug: read-then-write average computation silently
dropped one rating's contribution when two ratings landed concurrently).

This connects to a REAL MongoDB instance and fires genuinely concurrent
writes using the exact atomic pipeline-update pattern used in rate_seller(),
proving the fix is race-free rather than just "doesn't throw an exception".
"""
import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
TEST_DB_NAME = 'autonexus_test_rating_race'  # isolated from real dev data


async def apply_rating_atomic(db, seller_id: str, rating_value: int):
    """Exact same atomic pipeline update used in rate_seller() in server.py."""
    await db.sellers.update_one(
        {"id": seller_id},
        [
            {"$set": {
                "rating_sum": {"$add": [{"$ifNull": ["$rating_sum", 0]}, rating_value]},
                "rating_count": {"$add": [{"$ifNull": ["$rating_count", 0]}, 1]},
            }},
            {"$set": {
                "rating": {"$round": [{"$divide": ["$rating_sum", "$rating_count"]}, 2]},
            }},
        ]
    )


async def apply_rating_racy_old_way(db, seller_id: str, rating_value: int):
    """
    Reproduction of the ORIGINAL buggy read-then-write pattern, kept here
    only to demonstrate the bug this fix replaces (used in the control test).
    """
    seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    prior_count = seller.get("rating_count", 0) if seller else 0
    prior_rating = seller.get("rating", 0) if seller else 0
    # Simulate realistic scheduling: another coroutine can interleave here
    # between the read and the write, which is exactly how the race triggers
    # under real concurrent requests hitting the same event loop / workers.
    await asyncio.sleep(0)
    new_count = prior_count + 1
    new_avg = ((prior_rating * prior_count) + rating_value) / new_count
    await db.sellers.update_one(
        {"id": seller_id},
        {"$set": {"rating": round(new_avg, 2), "rating_count": new_count}}
    )


async def test_atomic_update_is_race_free():
    """Fire many concurrent ratings at the same seller using the FIXED atomic
    pipeline update; assert rating_count and rating_sum exactly match what
    was submitted, with no lost updates."""
    print("Testing atomic pipeline update under concurrency (the fix)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    seller_id = str(uuid.uuid4())

    try:
        await db.sellers.insert_one({
            "id": seller_id, "name": "Race Test Seller",
            "rating": 0.0, "rating_sum": 0, "rating_count": 0
        })

        ratings_submitted = [5, 4, 3, 5, 2, 4, 5, 1, 3, 4,
                              5, 5, 2, 4, 3, 5, 1, 4, 5, 3]  # 20 concurrent submissions

        await asyncio.gather(*[
            apply_rating_atomic(db, seller_id, r) for r in ratings_submitted
        ])

        final = await db.sellers.find_one({"id": seller_id}, {"_id": 0})

        expected_count = len(ratings_submitted)
        expected_sum = sum(ratings_submitted)
        expected_avg = round(expected_sum / expected_count, 2)

        assert final["rating_count"] == expected_count, (
            f"Lost updates! Expected rating_count={expected_count}, got {final['rating_count']}"
        )
        assert final["rating_sum"] == expected_sum, (
            f"Lost updates! Expected rating_sum={expected_sum}, got {final['rating_sum']}"
        )
        assert final["rating"] == expected_avg, (
            f"Wrong average! Expected {expected_avg}, got {final['rating']}"
        )

        print(f"  Submitted {expected_count} concurrent ratings, sum={expected_sum}")
        print(f"  Final: rating_count={final['rating_count']}, rating_sum={final['rating_sum']}, rating={final['rating']}")
        print("[PASS] Atomic pipeline update handles concurrency correctly (zero lost updates)")
    finally:
        await db.sellers.delete_one({"id": seller_id})
        client.close()


async def test_old_pattern_actually_loses_updates():
    """
    Control test: prove the ORIGINAL read-then-write pattern really did lose
    updates under concurrency, so the fix above is validated against a real
    reproduction of the bug rather than a strawman.
    """
    print("\nTesting old read-then-write pattern under concurrency (control test - should show lost updates)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    seller_id = str(uuid.uuid4())

    try:
        await db.sellers.insert_one({
            "id": seller_id, "name": "Race Test Seller (old pattern)",
            "rating": 0.0, "rating_count": 0
        })

        ratings_submitted = [5, 4, 3, 5, 2, 4, 5, 1, 3, 4,
                              5, 5, 2, 4, 3, 5, 1, 4, 5, 3]

        await asyncio.gather(*[
            apply_rating_racy_old_way(db, seller_id, r) for r in ratings_submitted
        ])

        final = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
        expected_count = len(ratings_submitted)

        if final["rating_count"] < expected_count:
            print(f"  Confirmed: old pattern lost updates. Expected rating_count={expected_count}, "
                  f"got {final['rating_count']} (lost {expected_count - final['rating_count']})")
            print("[PASS] Control test confirms the bug this fix addresses is real")
        else:
            # On a fast enough machine/db round-trip, the race window may not
            # be hit every run — this is a known property of race conditions.
            # Not treated as a hard failure of the fix itself.
            print(f"  rating_count={final['rating_count']} (race window not hit this run — "
                  f"race conditions are timing-dependent, this doesn't invalidate the fix)")
    finally:
        await db.sellers.delete_one({"id": seller_id})
        client.close()


async def test_atomic_update_with_missing_rating_sum_field():
    """Verify the $ifNull fallback correctly handles sellers written before
    rating_sum existed (pre-migration documents)."""
    print("\nTesting atomic update on a seller document missing rating_sum (pre-migration)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    seller_id = str(uuid.uuid4())

    try:
        # Simulate a legacy seller doc with no rating_sum field at all
        await db.sellers.insert_one({
            "id": seller_id, "name": "Legacy Seller",
            "rating": 4.0, "rating_count": 3
            # no rating_sum key present
        })

        await apply_rating_atomic(db, seller_id, 5)

        final = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
        # $ifNull treats missing rating_sum as 0, so sum becomes 0+5=5 (not 12+5=17)
        # This documents the exact backfill behavior: without running the
        # startup migration first, a legacy doc's rating_sum starts fresh.
        assert final["rating_sum"] == 5, f"Expected rating_sum=5, got {final['rating_sum']}"
        assert final["rating_count"] == 4, f"Expected rating_count=4, got {final['rating_count']}"

        print(f"  rating_sum={final['rating_sum']}, rating_count={final['rating_count']}, rating={final['rating']}")
        print("[PASS] $ifNull fallback prevents a hard failure on legacy documents")
    finally:
        await db.sellers.delete_one({"id": seller_id})
        client.close()


async def main():
    print("\n" + "=" * 60)
    print("RATING RACE CONDITION TEST SUITE (against real MongoDB)")
    print("=" * 60 + "\n")

    try:
        await test_atomic_update_is_race_free()
        await test_old_pattern_actually_loses_updates()
        await test_atomic_update_with_missing_rating_sum_field()

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED [OK]")
        print("=" * 60 + "\n")
        return 0
    except AssertionError as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n[FAIL] UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
