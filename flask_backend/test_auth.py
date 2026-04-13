import urllib.request
import urllib.error
import json
import http.cookiejar

BASE_URL = "http://localhost:5000"

# Create a cookie jar to handle cookies
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
urllib.request.install_opener(opener)

# First, try to login
print("Attempting to login as admin...")
login_data = json.dumps({"email": "test.admin@example.com", "password": "testpass123"}).encode()
try:
    login_req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    login_response = opener.open(login_req)
    login_data_response = json.loads(login_response.read().decode())
    print(f"Login successful: {login_data_response}")
    print(f"Cookies: {cookie_jar}")
except urllib.error.HTTPError as e:
    print(f"Login failed {e.code}: {e.reason}")
    error_data = json.loads(e.read().decode())
    print(f"Error: {error_data}")
    exit()

# Now test the enrollment endpoint with cookies
print("\nTesting /admin/students with cookies...")
try:
    req = urllib.request.Request(
        f"{BASE_URL}/admin/students",
        headers={"Content-Type": "application/json"}
    )
    response = opener.open(req)
    print(f"Status: {response.status}")
    data = json.loads(response.read().decode())
    print(f"Success! Got {len(data)} students")
    if data:
        print(f"First student: {json.dumps(data[0], indent=2)}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.reason}")
    error_data = json.loads(e.read().decode())
    print(f"Error details: {error_data}")
