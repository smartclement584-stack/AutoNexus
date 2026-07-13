"""
Test admin audit trail for seller approval/rejection.
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, str(Path(__file__).parent))

from server import AdminAction, Seller

# Mock database for testing
class MockDB:
    def __init__(self):
        self.sellers = {}
        self.admin_actions = []

async def test_admin_action_model():
    """Test that AdminAction model can be created and serialized."""
    print("Testing AdminAction model...")

    action = AdminAction(
        admin_id="admin-123",
        admin_name="Alice Admin",
        action_type="approve_seller",
        target_seller_id="seller-456",
        target_seller_name="Bob's Auto Parts",
        reason="Verified documents"
    )

    # Test model_dump() works
    action_dict = action.model_dump()
    assert action_dict["admin_id"] == "admin-123"
    assert action_dict["admin_name"] == "Alice Admin"
    assert action_dict["action_type"] == "approve_seller"
    assert action_dict["target_seller_id"] == "seller-456"
    assert action_dict["reason"] == "Verified documents"
    assert "id" in action_dict
    assert "created_at" in action_dict

    print("[PASS] AdminAction model works correctly")

async def test_seller_audit_fields():
    """Test that Seller model has audit fields."""
    print("Testing Seller audit fields...")

    now = datetime.now(timezone.utc)
    seller = Seller(
        name="Test Parts",
        location="Douala",
        phone="+237670000000",
        whatsapp="+237670000000",
        approved_by="admin-123",
        approved_at=now,
    )

    seller_dict = seller.model_dump()
    assert seller_dict["approved_by"] == "admin-123"
    assert seller_dict["approved_at"] == now
    assert seller_dict["rejected_by"] is None
    assert seller_dict["rejected_at"] is None

    print("[PASS] Seller audit fields exist and are serializable")

async def test_audit_trail_simulation():
    """Simulate an approve action and verify audit trail would be recorded."""
    print("Testing audit trail simulation...")

    # Simulate what happens when admin approves a seller
    admin_id = "admin-alice-123"
    admin_name = "Alice Admin"
    seller_id = "seller-bob-456"
    seller_name = "Bob's Auto Parts"

    # Create the action record (what would be inserted into db.admin_actions)
    action = AdminAction(
        admin_id=admin_id,
        admin_name=admin_name,
        action_type="approve_seller",
        target_seller_id=seller_id,
        target_seller_name=seller_name,
    )

    action_dict = action.model_dump()
    action_dict["created_at"] = action_dict["created_at"].isoformat()

    # Verify all required fields are present
    assert action_dict["id"] is not None, "Action must have an ID"
    assert action_dict["admin_id"] == admin_id
    assert action_dict["admin_name"] == admin_name
    assert action_dict["action_type"] == "approve_seller"
    assert action_dict["target_seller_id"] == seller_id
    assert action_dict["target_seller_name"] == seller_name
    assert "created_at" in action_dict
    assert isinstance(action_dict["created_at"], str), "created_at must be ISO string for storage"

    # Verify can be parsed back
    parsed = AdminAction(**action_dict)
    assert parsed.admin_id == admin_id

    print("[PASS] Audit trail simulation successful")

async def test_reject_audit_trail():
    """Test rejection audit trail."""
    print("Testing rejection audit trail...")

    admin = {
        "id": "admin-charlie-789",
        "name": "Charlie Admin"
    }
    seller = {
        "id": "seller-dave-012",
        "name": "Dave's Parts"
    }

    # Simulate reject action
    action = AdminAction(
        admin_id=admin["id"],
        admin_name=admin.get("name"),
        action_type="reject_seller",
        target_seller_id=seller["id"],
        target_seller_name=seller.get("name"),
        reason="Unverifiable ID documents"
    )

    action_dict = action.model_dump()
    assert action_dict["action_type"] == "reject_seller"
    assert action_dict["reason"] == "Unverifiable ID documents"

    print("[PASS] Rejection audit trail works correctly")

async def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("ADMIN AUDIT TRAIL TEST SUITE")
    print("="*60 + "\n")

    try:
        await test_admin_action_model()
        await test_seller_audit_fields()
        await test_audit_trail_simulation()
        await test_reject_audit_trail()

        print("\n" + "="*60)
        print("ALL TESTS PASSED [OK]")
        print("="*60 + "\n")
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
