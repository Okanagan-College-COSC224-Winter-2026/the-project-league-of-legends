import requests
import json

BASE_URL = "http://localhost:5000"

# First, create a test session
session = requests.Session()

# Try to login as admin
print("Attempting login...")
login_response = session.post(
    f"{BASE_URL}/auth/login",
    json={"email": "admin@example.com", "password": "admin123"},
    headers={"Content-Type": "application/json"}
)

print(f"Login status: {login_response.status_code}")
if login_response.status_code != 200:
    print(f"Login error: {login_response.text}")
else:
    print(f"Login successful: {login_response.json()}")

# Now test the /admin/students endpoint
print("\nTesting /admin/students...")
students_response = session.get(
    f"{BASE_URL}/admin/students",
    headers={"Content-Type": "application/json"}
)

print(f"Status: {students_response.status_code}")
print(f"Response: {students_response.text}")

# Test /admin/classes-with-students
print("\nTesting /admin/classes-with-students...")
classes_response = session.get(
    f"{BASE_URL}/admin/classes-with-students",
    headers={"Content-Type": "application/json"}
)

print(f"Status: {classes_response.status_code}")
print(f"Response: {classes_response.text[:500]}")
