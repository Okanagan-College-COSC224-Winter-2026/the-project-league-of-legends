"""
User management endpoints
"""
import os
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import Schema, ValidationError, fields, validate
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from ..models import User, UserSchema

bp = Blueprint("user", __name__, url_prefix="/user")

# Create schema instances once (reusable)
user_schema = UserSchema()

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_image(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS
    )

def get_profile_picture_folder() -> str:
    folder = os.path.join(
        current_app.instance_path,
        "uploads",
        "profile_pictures",
    )
    os.makedirs(folder, exist_ok=True)
    return folder



class UserUpdateSchema(Schema):
    """Schema for updating private/self profile information"""

    username = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(min=1, max=100),
    )
    pronouns = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.Length(max=100),
    )


user_update_schema = UserUpdateSchema()


@bp.route("/", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current authenticated user information"""
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user_schema.dump(user)), 200


@bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user_by_id(user_id):
    """Get user by ID (users can view their own info, teachers/admins can view anyone)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)

    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Users can view their own info, teachers and admins can view anyone
    if current_user.id != user_id and not current_user.has_role("teacher", "admin"):
        return jsonify({"msg": "Insufficient permissions"}), 403

    return jsonify(user_schema.dump(user)), 200


@bp.route("/", methods=["PUT"])
@jwt_required()
def update_current_user():
    """
    Update current user private profile info.

    Supports either:
    - multipart/form-data for username/pronouns/profile picture
    - application/json for username/pronouns
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    if request.content_type and request.content_type.startswith("multipart/form-data"):
        raw_data = {
            "username": request.form.get("username"),
            "pronouns": request.form.get("pronouns"),
        }
    elif request.is_json:
        raw_data = request.get_json() or {}
    else:
        return jsonify({"msg": "Expected JSON or multipart form data"}), 400

    cleaned_data = {}
    for key in ("username", "pronouns"):
        if key in raw_data:
            value = raw_data.get(key)
            if value == "":
                cleaned_data[key] = None
            else:
                cleaned_data[key] = value

    try:
        data = user_update_schema.load(cleaned_data)
    except ValidationError as err:
        return jsonify({"msg": "Validation error", "errors": err.messages}), 400

    if "username" in data:
        user.username = data["username"]

    if "pronouns" in data:
        user.pronouns = data["pronouns"]

    uploaded_file = request.files.get("profile_picture")
    if uploaded_file and uploaded_file.filename:
        if not allowed_image(uploaded_file.filename):
            return jsonify({"msg": "Invalid image file type"}), 400

        original_name = secure_filename(uploaded_file.filename)
        ext = original_name.rsplit(".", 1)[1].lower()
        filename = f"user_{user.id}_{uuid.uuid4().hex}.{ext}"

        folder = get_profile_picture_folder()
        save_path = os.path.join(folder, filename)
        uploaded_file.save(save_path)

        user.profile_picture = filename

    user.update()

    return jsonify(
        {
            "msg": "Profile updated successfully",
            "user": user_schema.dump(user),
        }
    ), 200

@bp.route("/profile-picture/<path:filename>", methods=["GET"])
def get_profile_picture(filename):
    """Serve uploaded profile pictures"""
    folder = get_profile_picture_folder()
    return send_from_directory(folder, filename)

@bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    """Delete user (admin only or own account)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)

    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Users can delete their own account, admins can delete anyone
    if current_user.id != user_id and not current_user.is_admin():
        return jsonify({"msg": "Insufficient permissions"}), 403

    user.delete()

    return jsonify({"msg": "User deleted successfully"}), 200


@bp.route("/password", methods=["PATCH"])
@jwt_required()
def change_password():
    """Change current user's password"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    current_password = request.json.get("current_password", None)
    new_password = request.json.get("new_password", None)

    if not current_password:
        return jsonify({"msg": "Current password is required"}), 400
    if not new_password:
        return jsonify({"msg": "New password is required"}), 400
    if len(new_password) < 6:
        return jsonify({"msg": "New password must be at least 6 characters"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Verify current password
    if not check_password_hash(user.hash_pass, current_password):
        return jsonify({"msg": "Current password is incorrect"}), 401

    # Update password and clear must_change_password flag
    user.hash_pass = generate_password_hash(new_password)
    user.must_change_password = False
    user.update()

    return jsonify({"msg": "Password updated successfully"}), 200
