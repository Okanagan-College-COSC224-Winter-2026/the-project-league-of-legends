"""
Tests for change password endpoint
"""

import json
from werkzeug.security import check_password_hash
from api.models import User


def test_change_password_success(test_client):
    """
    GIVEN a logged-in user
    WHEN PATCH /user/password is called with correct current password and new password
    THEN the password should be updated successfully
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "oldpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Change password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword", "new_password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["msg"] == "Password updated successfully"


def test_change_password_unauthorized(test_client):
    """
    GIVEN no authentication token
    WHEN PATCH /user/password is called
    THEN it should return 401
    """
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword", "new_password": "newpassword"}),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 401


def test_change_password_wrong_current_password(test_client):
    """
    GIVEN a logged-in user
    WHEN PATCH /user/password is called with incorrect current password
    THEN it should return 401
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "correctpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "correctpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to change password with wrong current password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "wrongpassword", "new_password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 401
    assert response.json["msg"] == "Current password is incorrect"


def test_change_password_weak_new_password(test_client):
    """
    GIVEN a logged-in user
    WHEN PATCH /user/password is called with new password less than 6 characters
    THEN it should return 400
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "oldpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to change password with weak new password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword", "new_password": "short"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json["msg"] == "New password must be at least 6 characters"


def test_change_password_missing_current_password(test_client):
    """
    GIVEN a logged-in user
    WHEN PATCH /user/password is called without current_password
    THEN it should return 400
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "oldpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to change password without current password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"new_password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json["msg"] == "Current password is required"


def test_change_password_missing_new_password(test_client):
    """
    GIVEN a logged-in user
    WHEN PATCH /user/password is called without new_password
    THEN it should return 400
    """
    # Register and login
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "oldpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to change password without new password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert response.json["msg"] == "New password is required"



def test_change_password_clears_must_change_flag(test_client, app, db):
    """
    GIVEN a user with must_change_password set to True
    WHEN PATCH /user/password is called successfully
    THEN the must_change_password flag should be cleared
    """
    from werkzeug.security import generate_password_hash

    # Manually create a user with must_change_password=True
    with app.app_context():
        user = User(
            name="testuser",
            email="test@example.com",
            hash_pass=generate_password_hash("oldpassword"),
            role="student",
            must_change_password=True
        )
        db.session.add(user)
        db.session.commit()

    # Login
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    # Change password
    response = test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword", "new_password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200

    # Verify the flag was cleared
    with app.app_context():
        updated_user = User.query.filter_by(email="test@example.com").first()
        assert updated_user.must_change_password is False


def test_login_with_new_password_after_change(test_client):
    """
    GIVEN a user who changed their password
    WHEN logging in with the new password
    THEN login should succeed
    """
    # Register with original password
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "testuser", "password": "oldpassword", "email": "test@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Login and change password
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.patch(
        "/user/password",
        data=json.dumps({"current_password": "oldpassword", "new_password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to login with old password (should fail)
    response1 = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "oldpassword"}),
        headers={"Content-Type": "application/json"},
    )
    assert response1.status_code == 401

    # Try to login with new password (should succeed)
    response2 = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "test@example.com", "password": "newpassword123"}),
        headers={"Content-Type": "application/json"},
    )
    assert response2.status_code == 200

