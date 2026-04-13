import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:5000"

# Test the /admin/students endpoint
print("Testing /admin/students (no auth)...")
try:
    req = urllib.request.Request(
        f"{BASE_URL}/admin/students",
        headers={"Content-Type": "application/json"}
    )
    response = urllib.request.urlopen(req)
    print(f"Status: {response.status}")
    data = json.loads(response.read().decode())
    print(f"Response: {json.dumps(data, indent=2)[:500]}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.reason}")
    try:
        error_data = json.loads(e.read().decode())
        print(f"Error details: {error_data}")
    except:
        print(f"Error body: {e.read().decode()}")
