import pytest
from werkzeug.security import generate_password_hash

from api import create_app
from api.models import User, Course, User_Course
from api.models.db import db as _db
import json
import os

def test_HTTPGET(test_client):
    response = test_client.get("/example/test")
    
    assert response.status_code == 200
    data = response.json
    
    assert "course" in data
    assert data["course"] == "cosc 224"

if __name__ == '__main__':
    unittest.main()