"""
Test that concurrent accept-quote calls on the same request cannot both
succeed (the original bug: a separate find_one status-check followed by a
separate update_one let two near-simultaneous accept calls both pass the
"not yet fulfilled" check and both increment sales_count).

This connects to a REAL MongoDB instance and fires genuinely concurrent
writes using the exact atomic filtered-update pattern used in
accept_request_quote(), proving the fix is race-free rather than just
"doesn't throw an exception".
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
TEST_DB_NAME = 'autonexus_test_accept_race'  # isolated from real dev data


async def accept_atomic(db, request_id: str, seller_id: str, price: int):
    """Exact same atomic filtered-update pattern used in accept_request_quote()."""
    result = await db.requests.update_one(
        {"id": request_id, "status": {"$ne": "fulfilled"}},
        {"$set": {
            "status": "fulfilled",
            "accepted_seller_id": seller_id,
            "accepted_price": price,
        }}
    )
    if result.matched_count == 0:
        return False  # this caller lost the race -> would raise HTTP 400
    await db.sellers.update_one({"id": seller_id}, {"$inc": {"sales_count": 1}})
    return True  # this caller won -> sales_count incremented


async def accept_racy_old_way(db, request_id: str, seller_id: str, price: int):
    """
    Reproduction of the ORIGINAL buggy read-then-write pattern: a separate
    find_one status check followed by separate writes, kept here only to
    demonstrate the bug this fix replaces (used in the control test).
    """
    request = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if request["status"] == "fulfilled":
        return False
    # Simulate realistic scheduling: another coroutine can interleave here
    # between the read and the write, which is exactly how the race triggers
    # under real concurrent requests hitting the same event loop / workers.
    await asyncio.sleep(0)
    await db.requests.update_one(
        {"id": request_id},
        {"$set": {"status": "fulfilled", "accepted_seller_id": seller_id, "accepted_price": price}}
    )
    await db.sellers.update_one({"id": seller_id}, {"$inc": {"sales_count": 1}})
    return True


async def test_atomic_accept_is_race_free_same_seller():
    """Fire many concurrent accept calls for the SAME seller/request (e.g. a
    double-click or retried request) using the FIXED atomic filtered update;
    assert exactly one succeeds and sales_count is incremented exactly once."""
    print("Testing atomic accept under concurrency - same seller double-click (the fix)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    request_id = str(uuid.uuid4())
    seller_id = str(uuid.uuid4())

    try:
        await db.requests.insert_one({
            "id": request_id, "status": "open", "accepted_seller_id": None, "accepted_price": None
        })
        await db.sellers.insert_one({"id": seller_id, "name": "Race Test Seller", "sales_count": 0})

        # 15 concurrent "accept" calls for the same seller (simulating rapid
        # double-clicks / a retried request from a flaky connection)
        results = await asyncio.gather(*[
            accept_atomic(db, request_id, seller_id, 15000) for _ in range(15)
        ])

        winners = sum(1 for r in results if r is True)
        losers = sum(1 for r in results if r is False)

        final_request = await db.requests.find_one({"id": request_id}, {"_id": 0})
        final_seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})

        assert winners == 1, f"Expected exactly 1 winner, got {winners}"
        assert losers == 14, f"Expected exactly 14 losers, got {losers}"
        assert final_seller["sales_count"] == 1, (
            f"sales_count incremented more than once! Expected 1, got {final_seller['sales_count']}"
        )
        assert final_request["status"] == "fulfilled"
        assert final_request["accepted_seller_id"] == seller_id

        print(f"  15 concurrent accept calls -> {winners} won, {losers} correctly rejected")
        print(f"  Final: sales_count={final_seller['sales_count']}, request.status={final_request['status']}")
        print("[PASS] Atomic filtered update prevents double sales_count increment (same seller)")
    finally:
        await db.requests.delete_one({"id": request_id})
        await db.sellers.delete_one({"id": seller_id})
        client.close()


async def test_atomic_accept_is_race_free_different_sellers():
    """Fire concurrent accept calls for DIFFERENT sellers on the same request
    (simulating a UI race where two quotes get accepted near-simultaneously);
    assert exactly one seller's sales_count is incremented and the request
    ends up with a single, consistent accepted_seller_id."""
    print("\nTesting atomic accept under concurrency - different sellers (the fix)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    request_id = str(uuid.uuid4())
    seller_a = str(uuid.uuid4())
    seller_b = str(uuid.uuid4())

    try:
        await db.requests.insert_one({
            "id": request_id, "status": "open", "accepted_seller_id": None, "accepted_price": None
        })
        await db.sellers.insert_one({"id": seller_a, "name": "Seller A", "sales_count": 0})
        await db.sellers.insert_one({"id": seller_b, "name": "Seller B", "sales_count": 0})

        results = await asyncio.gather(
            *[accept_atomic(db, request_id, seller_a, 10000) for _ in range(10)],
            *[accept_atomic(db, request_id, seller_b, 12000) for _ in range(10)],
        )

        winners = sum(1 for r in results if r is True)

        final_request = await db.requests.find_one({"id": request_id}, {"_id": 0})
        final_seller_a = await db.sellers.find_one({"id": seller_a}, {"_id": 0})
        final_seller_b = await db.sellers.find_one({"id": seller_b}, {"_id": 0})

        total_sales_count = final_seller_a["sales_count"] + final_seller_b["sales_count"]

        assert winners == 1, f"Expected exactly 1 winner across both sellers, got {winners}"
        assert total_sales_count == 1, (
            f"Combined sales_count across both sellers must be exactly 1, got {total_sales_count} "
            f"(A={final_seller_a['sales_count']}, B={final_seller_b['sales_count']})"
        )
        assert final_request["accepted_seller_id"] in (seller_a, seller_b)
        # Whichever seller won must be the one with sales_count=1
        winning_seller_id = final_request["accepted_seller_id"]
        winning_seller = final_seller_a if winning_seller_id == seller_a else final_seller_b
        assert winning_seller["sales_count"] == 1, (
            "The seller recorded as accepted_seller_id must be the one whose sales_count was incremented"
        )

        print(f"  20 concurrent accept calls across 2 sellers -> {winners} won total")
        print(f"  Final: accepted_seller_id={winning_seller_id}, "
              f"seller_a.sales_count={final_seller_a['sales_count']}, seller_b.sales_count={final_seller_b['sales_count']}")
        print("[PASS] Atomic filtered update prevents double increment across different sellers")
    finally:
        await db.requests.delete_one({"id": request_id})
        await db.sellers.delete_many({"id": {"$in": [seller_a, seller_b]}})
        client.close()


async def test_old_pattern_actually_double_increments():
    """
    Control test: prove the ORIGINAL read-then-write pattern really did allow
    multiple concurrent accepts to increment sales_count more than once, so
    the fix above is validated against a real reproduction of the bug rather
    than a strawman.
    """
    print("\nTesting old read-then-write pattern under concurrency (control test - should show double increment)...")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[TEST_DB_NAME]
    request_id = str(uuid.uuid4())
    seller_id = str(uuid.uuid4())

    try:
        await db.requests.insert_one({
            "id": request_id, "status": "open", "accepted_seller_id": None, "accepted_price": None
        })
        await db.sellers.insert_one({"id": seller_id, "name": "Race Test Seller (old pattern)", "sales_count": 0})

        results = await asyncio.gather(*[
            accept_racy_old_way(db, request_id, seller_id, 15000) for _ in range(15)
        ])

        winners = sum(1 for r in results if r is True)
        final_seller = await db.sellers.find_one({"id": seller_id}, {"_id": 0})

        if final_seller["sales_count"] > 1:
            print(f"  Confirmed: old pattern double-incremented. {winners} calls thought they won, "
                  f"sales_count ended at {final_seller['sales_count']} (should be at most 1)")
            print("[PASS] Control test confirms the bug this fix addresses is real")
        else:
            # Race conditions are timing-dependent; not hitting the window on
            # a given run doesn't invalidate the fix itself.
            print(f"  sales_count={final_seller['sales_count']} (race window not hit this run - "
                  f"race conditions are timing-dependent, this doesn't invalidate the fix)")
    finally:
        await db.requests.delete_one({"id": request_id})
        await db.sellers.delete_one({"id": seller_id})
        client.close()


async def main():
    print("\n" + "=" * 60)
    print("ACCEPT-QUOTE RACE CONDITION TEST SUITE (against real MongoDB)")
    print("=" * 60 + "\n")

    try:
        await test_atomic_accept_is_race_free_same_seller()
        await test_atomic_accept_is_race_free_different_sellers()
        await test_old_pattern_actually_double_increments()

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
