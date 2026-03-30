"""
Tests for admin management endpoints
"""

import json


def test_list_users_admin_only(test_client):
    """
    GIVEN an admin user
    WHEN GET /admin/users is called
    THEN all users should be returned
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create a second user for listing
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Update first user to admin role (using database directly in conftest)
    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Get users
    response = test_client.get("/admin/users")

    assert response.status_code == 200
    users = response.json
    assert len(users) >= 2
    assert any(u["email"] == "admin@example.com" for u in users)
    assert any(u["email"] == "student@example.com" for u in users)


def test_list_users_non_admin_forbidden(test_client):
    """
    GIVEN a non-admin user
    WHEN GET /admin/users is called
    THEN it should return 403
    """
    # Register and login as student
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to get users
    response = test_client.get("/admin/users")

    assert response.status_code == 403


def test_create_user_as_admin(test_client):
    """
    GIVEN an admin user
    WHEN POST /admin/users/create is called with valid user data
    THEN a new user should be created
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Create a new user
    response = test_client.post(
        "/admin/users/create",
        data=json.dumps({
            "name": "New Teacher",
            "email": "teacher@example.com",
            "password": "temppass123",
            "role": "teacher",
            "must_change_password": True
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 201
    assert response.json["user"]["name"] == "New Teacher"
    assert response.json["user"]["email"] == "teacher@example.com"
    assert response.json["user"]["role"] == "teacher"

    # Verify user can login
    login_response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "temppass123"}),
        headers={"Content-Type": "application/json"},
    )
    assert login_response.status_code == 200


def test_create_user_duplicate_email(test_client):
    """
    GIVEN an admin user
    WHEN POST /admin/users/create is called with an email that already exists
    THEN it should return 400
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to create user with duplicate email
    response = test_client.post(
        "/admin/users/create",
        data=json.dumps({
            "name": "Duplicate",
            "email": "admin@example.com",
            "password": "temppass123",
            "role": "student"
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "already registered" in response.json["msg"]


def test_update_user_role(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id>/role is called with a new role
    THEN the user's role should be updated
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Update student to teacher
    response = test_client.put(
        f"/admin/users/{student_id}/role",
        data=json.dumps({"role": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["user"]["role"] == "teacher"

    # Verify in database
    updated_student = User.get_by_email("student@example.com")
    assert updated_student.role == "teacher"


def test_update_user_details(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id> is called with new name and/or email
    THEN the user details should be updated
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Update student name and email
    response = test_client.put(
        f"/admin/users/{student_id}",
        data=json.dumps({
            "name": "John Doe",
            "email": "john@example.com"
        }),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["user"]["name"] == "John Doe"
    assert response.json["user"]["email"] == "john@example.com"

    # Verify in database
    updated_student = User.get_by_email("john@example.com")
    assert updated_student.name == "John Doe"


def test_update_user_name_only(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id> is called with only name
    THEN only the name should be updated
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Update student name only
    response = test_client.put(
        f"/admin/users/{student_id}",
        data=json.dumps({"name": "Jane Doe"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.json["user"]["name"] == "Jane Doe"
    assert response.json["user"]["email"] == "student@example.com"  # Unchanged


def test_delete_user(test_client):
    """
    GIVEN an admin user
    WHEN DELETE /admin/users/<id> is called
    THEN the user should be deleted
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "123456", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Delete student
    response = test_client.delete(f"/admin/users/{student_id}")

    assert response.status_code == 200

    # Verify user is deleted
    deleted_user = User.get_by_email("student@example.com")
    assert deleted_user is None


def test_delete_user_prevents_self_deletion(test_client):
    """
    GIVEN an admin user
    WHEN DELETE /admin/users/<id> is called with their own ID
    THEN it should return 400 and not delete the user
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()
    admin_id = admin.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to delete self
    response = test_client.delete(f"/admin/users/{admin_id}")

    assert response.status_code == 400
    assert "Cannot delete your own account" in response.json["msg"]

    # Verify admin still exists
    admin_after = User.get_by_email("admin@example.com")
    assert admin_after is not None


def test_admin_prevent_role_self_demotion(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id>/role is called to demote their own role
    THEN it should return 400 and prevent the demotion
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()
    admin_id = admin.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to demote self from admin
    response = test_client.put(
        f"/admin/users/{admin_id}/role",
        data=json.dumps({"role": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "Cannot demote yourself" in response.json["msg"]


def test_reset_user_password(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id>/password is called with a new password
    THEN the user's password should be reset and they'll be required to change it on next login
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "oldpass123", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Reset student password
    response = test_client.put(
        f"/admin/users/{student_id}/password",
        data=json.dumps({"password": "newtemp123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert "Password reset" in response.json["msg"]
    assert response.json["user"]["must_change_password"] == True

    # Old password should no longer work
    login_response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "oldpass123"}),
        headers={"Content-Type": "application/json"},
    )
    assert login_response.status_code == 401

    # New password should work
    login_response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "newtemp123"}),
        headers={"Content-Type": "application/json"},
    )
    assert login_response.status_code == 200


def test_reset_password_invalid_length(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id>/password is called with a short password
    THEN it should return 400
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    # Create student user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "student", "password": "oldpass123", "email": "student@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    student = User.get_by_email("student@example.com")
    student_id = student.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to reset with short password
    response = test_client.put(
        f"/admin/users/{student_id}/password",
        data=json.dumps({"password": "short"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "at least 6 characters" in response.json["msg"]


def test_reset_password_prevents_self_reset(test_client):
    """
    GIVEN an admin user
    WHEN PUT /admin/users/<id>/password is called for their own account
    THEN it should return 400 and not reset the password
    """
    # Create admin user
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    from api.models import User
    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()
    admin_id = admin.id

    # Login as admin
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    # Try to reset own password
    response = test_client.put(
        f"/admin/users/{admin_id}/password",
        data=json.dumps({"password": "newpass123"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 400
    assert "own password change endpoint" in response.json["msg"]

    # Old password should still work
    login_response = test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )
    assert login_response.status_code == 200
