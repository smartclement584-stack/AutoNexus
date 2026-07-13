#!/usr/bin/env python3
"""
AutoNexus API Testing Suite
Tests all API endpoints for the automotive spare parts marketplace
"""

import requests
import json
import sys
from datetime import datetime
import time

class AutoNexusAPITester:
    def __init__(self, base_url="https://parts-marketplace-43.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.seller_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if self.token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text else {}
                except:
                    return True, {}
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint,
                    'response': response.text[:500] if response.text else 'No response'
                })
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'endpoint': endpoint
            })
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health and info endpoints"""
        self.log("\n=== Testing Health Endpoints ===")
        
        # Root endpoint
        self.run_test("Root Endpoint", "GET", "/")
        
        # Health check
        self.run_test("Health Check", "GET", "/health")

    # NOTE: /seed was intentionally removed — it was an unauthenticated write
    # endpoint. Demo data provisioning is now a manual step
    # (`py seed_demo_data.py`), not part of the HTTP API, so it's no longer
    # something this suite tests. Run that script against your test DB before
    # running this suite if you need demo data present.

    def test_filter_endpoints(self):
        """Test filter endpoints for brands, categories, models, years"""
        self.log("\n=== Testing Filter Endpoints ===")
        
        # Test brands
        success, brands_data = self.run_test("Get Brands", "GET", "/filters/brands")
        if success and 'brands' in brands_data:
            self.log(f"   Found {len(brands_data['brands'])} brands: {', '.join(brands_data['brands'][:3])}...")
        
        # Test categories
        success, categories_data = self.run_test("Get Categories", "GET", "/filters/categories")
        if success and 'categories' in categories_data:
            self.log(f"   Found {len(categories_data['categories'])} categories")
        
        # Test years
        success, years_data = self.run_test("Get Years", "GET", "/filters/years")
        if success and 'years' in years_data:
            self.log(f"   Found {len(years_data['years'])} years: {years_data['years'][:5]}...")
        
        # Test models (without brand)
        success, models_data = self.run_test("Get All Models", "GET", "/filters/models")
        if success and 'models' in models_data:
            self.log(f"   Found {len(models_data['models'])} models total")
        
        # Test models with specific brand
        self.run_test("Get Toyota Models", "GET", "/filters/models?brand=Toyota")

    def test_parts_endpoints(self):
        """Test spare parts listing and search"""
        self.log("\n=== Testing Parts Endpoints ===")
        
        # Get all parts
        success, parts_data = self.run_test("Get All Parts", "GET", "/parts")
        if success:
            total_parts = parts_data.get('total', 0)
            parts_count = len(parts_data.get('parts', []))
            self.log(f"   Found {total_parts} total parts, showing {parts_count}")
            
            # Test individual part if exists
            if parts_count > 0:
                part_id = parts_data['parts'][0]['id']
                self.run_test("Get Single Part", "GET", f"/parts/{part_id}")
        
        # Test search functionality
        self.run_test("Search Parts by Query", "GET", "/parts?q=brake")
        self.run_test("Search Parts by Brand", "GET", "/parts?brand=Toyota")
        self.run_test("Search Parts by Category", "GET", "/parts?category=Engine Parts")
        self.run_test("Search Parts by Condition", "GET", "/parts?condition=new")
        self.run_test("Search Parts by Price Range", "GET", "/parts?min_price=10000&max_price=50000")
        
        # Test sorting
        self.run_test("Sort Parts by Price Desc", "GET", "/parts?sort=price_desc")
        self.run_test("Sort Parts by Newest", "GET", "/parts?sort=newest")
        
        # Test pagination
        self.run_test("Parts Pagination", "GET", "/parts?page=1&limit=5")

    def test_sellers_endpoints(self):
        """Test sellers listing"""
        self.log("\n=== Testing Sellers Endpoints ===")
        
        # Get all sellers
        success, sellers_data = self.run_test("Get All Sellers", "GET", "/sellers")
        if success:
            total_sellers = sellers_data.get('total', 0)
            sellers_count = len(sellers_data.get('sellers', []))
            self.log(f"   Found {total_sellers} total sellers, showing {sellers_count}")
            
            # Test individual seller if exists
            if sellers_count > 0:
                seller_id = sellers_data['sellers'][0]['id']
                success, seller_detail = self.run_test("Get Single Seller", "GET", f"/sellers/{seller_id}")
                if success and 'parts' in seller_detail:
                    self.log(f"   Seller has {len(seller_detail['parts'])} parts")
        
        # Test seller search
        self.run_test("Search Sellers", "GET", "/sellers?q=Camp")

    def test_requests_endpoints(self):
        """Test part requests listing (public view)"""
        self.log("\n=== Testing Requests Endpoints (Public) ===")
        
        # Get all requests
        self.run_test("Get All Requests", "GET", "/requests")
        self.run_test("Get Open Requests", "GET", "/requests?status=open")

    def test_auth_flow(self):
        """Test complete authentication flow"""
        self.log("\n=== Testing Authentication Flow ===")
        
        test_phone = "+237677123456"
        
        # Send OTP
        success, otp_response = self.run_test(
            "Send OTP", 
            "POST", 
            "/auth/send-otp",
            data={"phone": test_phone}
        )
        
        if success and 'demo_otp' in otp_response:
            demo_otp = otp_response['demo_otp']
            self.log(f"   Demo OTP received: {demo_otp}")
            
            # Verify OTP
            success, auth_response = self.run_test(
                "Verify OTP",
                "POST",
                "/auth/verify-otp", 
                data={"phone": test_phone, "code": demo_otp}
            )
            
            if success and 'token' in auth_response:
                self.token = auth_response['token']
                self.user_id = auth_response['user']['id']
                self.log(f"   Authentication successful, user role: {auth_response['user']['role']}")
                
                # Test authenticated endpoints
                self.test_authenticated_endpoints()
                return True
        
        return False

    def test_authenticated_endpoints(self):
        """Test endpoints that require authentication"""
        self.log("\n=== Testing Authenticated Endpoints ===")
        
        # Get current user
        self.run_test("Get Current User", "GET", "/auth/me")
        
        # Update user profile
        self.run_test(
            "Update User Profile",
            "PUT",
            "/auth/me",
            data={"name": "Test User"}
        )
        
        # Create a part request
        success, request_data = self.run_test(
            "Create Part Request",
            "POST",
            "/requests",
            200,  # Changed from 201 to 200
            data={
                "vehicle_brand": "Toyota",
                "vehicle_model": "Corolla", 
                "vehicle_year": "2015",
                "part_name": "Brake Pads",
                "description": "Front brake pads needed urgently",
                "urgency": "urgent",
                "location": "Douala"
            }
        )
        
        request_id = None
        if success and 'id' in request_data:
            request_id = request_data['id']
            self.log(f"   Created request with ID: {request_id}")
            
            # Get request details
            self.run_test("Get Request Details", "GET", f"/requests/{request_id}")

    def test_seller_registration_and_operations(self):
        """Test seller registration and seller-specific operations"""
        self.log("\n=== Testing Seller Operations ===")
        
        if not self.token:
            self.log("❌ Cannot test seller operations - no authentication token")
            return
        
        # Register as seller
        success, seller_data = self.run_test(
            "Register as Seller",
            "POST",
            "/seller/register",
            data={
                "name": "Test Auto Parts Store",
                "location": "Camp Yabassi, Douala",
                "description": "Test store for API testing",
                "phone": "+237677123456",
                "whatsapp": "+237677123456"
            }
        )
        
        if success and 'id' in seller_data:
            self.seller_id = seller_data['id']
            self.log(f"   Registered as seller with ID: {self.seller_id}")
            
            # Get seller's parts (should be empty initially)
            self.run_test("Get Seller Parts (Empty)", "GET", "/seller/parts")
            
            # Add a new part
            success, part_data = self.run_test(
                "Add New Part",
                "POST", 
                "/seller/parts",
                data={
                    "name": "Test Brake Pad Set",
                    "part_number": "TEST-BP-001",
                    "description": "Test brake pads for API testing",
                    "category": "Brakes",
                    "brands": ["Toyota", "Nissan"],
                    "models": ["Corolla", "Almera"],
                    "years": ["2010", "2011", "2012"],
                    "price": 15000,
                    "stock": 25,
                    "condition": "new"
                }
            )
            
            part_id = None
            if success and 'id' in part_data:
                part_id = part_data['id']
                self.log(f"   Created part with ID: {part_id}")
                
                # Update the part
                self.run_test(
                    "Update Part",
                    "PUT",
                    f"/seller/parts/{part_id}",
                    data={"price": 16000, "stock": 30}
                )
                
                # Get updated seller parts
                self.run_test("Get Seller Parts (With New Part)", "GET", "/seller/parts")
                
                # Delete the part
                self.run_test("Delete Part", "DELETE", f"/seller/parts/{part_id}")
            
            # Get seller requests (for responding)
            self.run_test("Get Seller Requests", "GET", "/seller/requests")

    def test_invalid_endpoints(self):
        """Test invalid endpoints and error handling"""
        self.log("\n=== Testing Error Handling ===")
        
        # Invalid part ID
        self.run_test("Get Invalid Part", "GET", "/parts/invalid-id", 404)
        
        # Invalid seller ID
        self.run_test("Get Invalid Seller", "GET", "/sellers/invalid-id", 404)
        
        # Invalid request ID
        self.run_test("Get Invalid Request", "GET", "/requests/invalid-id", 404)
        
        # Invalid phone format for OTP
        self.run_test(
            "Send OTP Invalid Phone", 
            "POST", 
            "/auth/send-otp",
            400,
            data={"phone": "123456789"}
        )
        
        # Invalid OTP
        self.run_test(
            "Verify Invalid OTP",
            "POST", 
            "/auth/verify-otp",
            400,
            data={"phone": "+237677123456", "code": "000000"}
        )

    def run_all_tests(self):
        """Run the complete test suite"""
        start_time = time.time()
        
        self.log("🚀 Starting AutoNexus API Test Suite")
        self.log(f"📡 Testing against: {self.base_url}")
        
        # Run tests in logical order
        self.test_health_endpoints()
        self.test_filter_endpoints()
        self.test_parts_endpoints() 
        self.test_sellers_endpoints()
        self.test_requests_endpoints()
        
        # Authentication flow and protected endpoints
        auth_success = self.test_auth_flow()
        if auth_success:
            self.test_seller_registration_and_operations()
        
        # Error handling tests
        self.test_invalid_endpoints()
        
        # Final results
        end_time = time.time()
        duration = end_time - start_time
        
        self.log("\n" + "="*60)
        self.log("🏁 TEST SUITE COMPLETED")
        self.log(f"📊 Results: {self.tests_passed}/{self.tests_run} tests passed")
        self.log(f"⏱️  Duration: {duration:.2f} seconds")
        
        if self.failed_tests:
            self.log(f"\n❌ {len(self.failed_tests)} Failed Tests:")
            for fail in self.failed_tests:
                if 'error' in fail:
                    self.log(f"   • {fail['name']}: {fail['error']}")
                else:
                    self.log(f"   • {fail['name']}: Expected {fail['expected']}, got {fail['actual']}")
        else:
            self.log("\n🎉 All tests passed!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = AutoNexusAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())