import functools

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from marshmallow import ValidationError
from werkzeug.security import check_password_hash, generate_password_hash

from ..models import User, UserLoginSchema, UserRegistrationSchema, UserSchema

bp = Blueprint("auth", __name__, url_prefix="/auth")

registration_schema = UserRegistrationSchema()
login_schema = UserLoginSchema()
user_schema = UserSchema()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


@bp.route("/register", methods=["POST"])
def register():
    """
    Public registration creates student accounts.
    - If email does NOT exist: create new student (no roster required).
    - If email exists AND must_change_password=True (roster placeholder): activate it.
    - If email exists AND must_change_password=False: block duplicate registration.
    """
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    try:
        data = registration_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    email = _normalize_email(data["email"])
    name = data["name"]
    password = data["password"]

    existing_user = User.get_by_email(email)

    # Case 1: brand new registration (not on roster yet is OK)
    if not existing_user:
        new_user = User(
            name=name,
            hash_pass=generate_password_hash(password),
            email=email,
            role="student",
            must_change_password=False,
        )
        User.create_user(new_user)
        return jsonify({"msg": "User registered successfully"}), 201

    # Case 2: roster placeholder -> activate account
    if existing_user.must_change_password:
        existing_user.name = name
        existing_user.hash_pass = generate_password_hash(password)
        existing_user.role = "student"
        existing_user.must_change_password = False
        existing_user.update()
        return jsonify({"msg": "User registered successfully"}), 201

    # Case 3: already a real account -> prevent duplicate
    return jsonify({"msg": f"User with email {email} is already registered"}), 400


@bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return JWT token in httponly cookie"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    try:
        data = login_schema.load(request.json)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    email = _normalize_email(data["email"])
    password = data["password"]

    user = User.get_by_email(email)
    if user is None or not check_password_hash(user.hash_pass, password):
        return jsonify({"msg": "Bad email or password"}), 401

    access_token = create_access_token(identity=email)
    response = jsonify(user_schema.dump(user))
    set_access_cookies(response, access_token)
    return response, 200


@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logout endpoint - clears the JWT cookie"""
    response = jsonify({"msg": "Successfully logged out"})
    unset_jwt_cookies(response)
    return response, 200


def jwt_role_required(*roles):
    """Decorator to require specific role(s) for JWT-protected endpoints"""

    def decorator(view):
        @functools.wraps(view)
        @jwt_required()
        def wrapped_view(*args, **kwargs):
            current_email = get_jwt_identity()
            user = User.get_by_email(current_email)

            if not user:
                return jsonify({"msg": "User not found"}), 404

            if roles and not user.has_role(*roles):
                return jsonify({"msg": "Insufficient permissions"}), 403

            return view(*args, **kwargs)

        return wrapped_view

    return decorator


@bp.route("/change_password", methods=["POST"])
@jwt_required()
def change_password():
    """
    Allows a logged-in user (teacher/admin/student) to change their password
    by providing the current password and a new password.
    """

    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    data = request.get_json()

    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        return jsonify({"msg": "Current password and new password are required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Verify current password
    if not check_password_hash(user.hash_pass, current_password):
        return jsonify({"msg": "Current password is incorrect"}), 400

    # Update password
    user.hash_pass = generate_password_hash(new_password)
    user.update()

    return jsonify({"msg": "Password changed successfully"}), 200


def jwt_admin_required(view):
    """Decorator to require admin role for JWT-protected endpoints"""
    return jwt_role_required("admin")(view)


def jwt_teacher_required(view):
    """Decorator to require teacher or admin role for JWT-protected endpoints"""
    return jwt_role_required("teacher", "admin")(view)