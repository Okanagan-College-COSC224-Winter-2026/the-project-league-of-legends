import pytest
from werkzeug.security import generate_password_hash

from api import create_app
from api.models import User, Course, User_Course
from api.models.db import db as _db
import requests

base_url = "http://localhost:5000/assets"
TEMP_PATH = "/tmp/sqlalchemy-media"

def test_HTTPGET(test_client, sample_user):
    response = test_client.get("http://localhost:5000/practice/test")
    assert response.status_code == 200
    assert response.assertIsNotNone(response.content, "Response in test_RylanB is null")

            try:
            data = response.json()
        except ValueError:
            self.fail("Response is not a valid JSON")

                    self.assertIn("course", data, "Key 'course' not found in response")
        self.assertEqual(data["course"], "cosc 224", "Incorrect value for 'course'")

if __name__ == '__main__':
    unittest.main()