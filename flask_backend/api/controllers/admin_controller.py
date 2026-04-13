"""
Admin management endpoints
Only admin users can access these endpoints
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from werkzeug.security import generate_password_hash

from ..models import Course, User, UserSchema, User_Course
from ..models.db import db
from .auth_controller import _normalize_email, jwt_admin_required

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/users", methods=["GET"])
@jwt_admin_required
def list_all_users():
    """List all users (admin only)"""
    users = User.query.all()
    return jsonify(UserSchema(many=True).dump(users)), 200


@bp.route("/users/create", methods=["POST"])
@jwt_admin_required
def create_user():
    """Create a new user with any role (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    name = request.json.get("name", None)
    password = request.json.get("password", None)
    email = request.json.get("email", None)
    role = request.json.get("role", "student")
    must_change_password = request.json.get("must_change_password", False)

    if not name:
        return jsonify({"msg": "Name is required"}), 400
    if not password:
        return jsonify({"msg": "Password is required"}), 400
    if not email:
        return jsonify({"msg": "Email is required"}), 400

    # Validate role
    if role not in ["student", "teacher", "admin"]:
        return jsonify({"msg": "Invalid role. Must be 'student', 'teacher', or 'admin'"}), 400

    email = _normalize_email(email)

    # Check if user already exists
    existing_user = User.get_by_email(email)
    if existing_user:
        return jsonify({"msg": f"User with email {email} is already registered"}), 400

    # Create new user
    new_user = User(
        name=name,
        hash_pass=generate_password_hash(password),
        email=email,
        role=role,
        must_change_password=must_change_password
    )
    User.create_user(new_user)

    return (
        jsonify(
            {
                "msg": f"{role.capitalize()} account created successfully",
                "user": UserSchema().dump(new_user),
            }
        ),
        201,
    )


@bp.route("/users/<int:user_id>/role", methods=["PUT"])
@jwt_admin_required
def update_user_role(user_id):
    """Update a user's role (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    new_role = request.json.get("role", None)

    if not new_role:
        return jsonify({"msg": "Role is required"}), 400

    # Validate role
    if new_role not in ["student", "teacher", "admin"]:
        return jsonify({"msg": "Invalid role. Must be 'student', 'teacher', or 'admin'"}), 400

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Prevent self-demotion from admin
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)
    if current_user.id == user_id and new_role != "admin":
        return jsonify({"msg": "Cannot demote yourself from admin role"}), 400

    old_role = user.role
    user.role = new_role
    user.update()

    return (
        jsonify(
            {
                "msg": f"User role updated from {old_role} to {new_role}",
                "user": UserSchema().dump(user),
            }
        ),
        200,
    )


@bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_admin_required
def update_user(user_id):
    """Update a user's name and/or email (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    name = request.json.get("name")
    email = request.json.get("email")

    # At least one field must be provided
    if not name and not email:
        return jsonify({"msg": "At least one field (name or email) must be provided"}), 400

    # If email is being updated, check for duplicates
    if email:
        email = _normalize_email(email)
        if email != user.email:
            existing_user = User.get_by_email(email)
            if existing_user:
                return jsonify({"msg": f"Email {email} is already in use"}), 400

    # Update fields
    if name:
        user.name = name
    if email:
        user.email = email

    user.update()

    return (
        jsonify(
            {
                "msg": "User updated successfully",
                "user": UserSchema().dump(user),
            }
        ),
        200,
    )


@bp.route("/users/<int:user_id>/password", methods=["PUT"])
@jwt_admin_required
def reset_user_password(user_id):
    """Reset a user's password (admin only)"""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    new_password = request.json.get("password")

    if not new_password:
        return jsonify({"msg": "Password is required"}), 400

    if len(new_password) < 6:
        return jsonify({"msg": "Password must be at least 6 characters"}), 400

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Prevent self-password-change via this endpoint (use /user/password for that)
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)
    if current_user.id == user_id:
        return jsonify({"msg": "Use your own password change endpoint to change your password"}), 400

    user.hash_pass = generate_password_hash(new_password)
    user.must_change_password = True
    user.update()

    return (
        jsonify(
            {
                "msg": f"Password reset for user {user.name}. They will be required to change it on next login.",
                "user": UserSchema().dump(user),
            }
        ),
        200,
    )


@bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_admin_required
def delete_user(user_id):
    """Delete a user (admin only)"""
    current_email = get_jwt_identity()
    current_user = User.get_by_email(current_email)

    # Prevent self-deletion
    if current_user.id == user_id:
        return jsonify({"msg": "Cannot delete your own account"}), 400

    user = User.get_by_id(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    user.delete()

    return jsonify({"msg": "User deleted successfully"}), 200


@bp.route("/students", methods=["GET"])
@jwt_admin_required
def get_all_students():
    """Get all students with their enrollment details (admin only)."""
    students = db.session.query(User).filter(User.role == "student").order_by(User.name.asc()).all()

    payload = []
    for student in students:
        enrollments = db.session.query(User_Course).filter(User_Course.userID == student.id).all()
        enrolled_courses = []
        for enrollment in enrollments:
            course = db.session.get(Course, enrollment.courseID)
            if not course:
                continue

            teacher = db.session.get(User, course.teacherID)
            enrolled_courses.append(
                {
                    "id": course.id,
                    "name": course.name,
                    "teacher_name": teacher.name if teacher else "Unknown",
                }
            )

        enrolled_courses.sort(key=lambda course: (course["name"] or "").lower())
        payload.append(
            {
                "id": student.id,
                "name": student.name,
                "email": student.email,
                "enrolled_courses": enrolled_courses,
                "enrollment_count": len(enrolled_courses),
            }
        )

    return jsonify(payload), 200


@bp.route("/classes-with-students", methods=["GET"])
@jwt_admin_required
def get_classes_with_students():
    """Get all classes with their enrolled students (admin only)."""
    courses = db.session.query(Course).order_by(Course.name.asc()).all()

    payload = []
    for course in courses:
        enrollments = db.session.query(User_Course).filter(User_Course.courseID == course.id).all()
        enrolled_students = []
        for enrollment in enrollments:
            user = db.session.get(User, enrollment.userID)
            if user and user.role == "student":
                enrolled_students.append(
                    {
                        "id": user.id,
                        "name": user.name,
                        "email": user.email,
                    }
                )

        enrolled_students.sort(key=lambda student: (student["name"] or "").lower())
        teacher = db.session.get(User, course.teacherID)
        payload.append(
            {
                "id": course.id,
                "name": course.name,
                "teacher_id": course.teacherID,
                "teacher_name": teacher.name if teacher else "Unknown",
                "enrolled_students": enrolled_students,
                "student_count": len(enrolled_students),
            }
        )

    return jsonify(payload), 200


@bp.route("/enroll-student", methods=["POST"])
@jwt_admin_required
def admin_enroll_student():
    """Enroll a student in a class (admin only)."""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    student_id = request.json.get("student_id")
    class_id = request.json.get("class_id")

    if not student_id or not class_id:
        return jsonify({"msg": "Student ID and Class ID are required"}), 400

    student = db.session.get(User, student_id)
    if not student or student.role != "student":
        return jsonify({"msg": "Student not found"}), 404

    course = db.session.get(Course, class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    existing_enrollment = db.session.get(User_Course, (student_id, class_id))
    if existing_enrollment:
        return jsonify({"msg": f"Student {student.name} is already enrolled in {course.name}"}), 400

    User_Course.add(student_id, class_id)
    return (
        jsonify(
            {
                "msg": f"Student {student.name} enrolled in {course.name}",
                "student_id": int(student_id),
                "class_id": int(class_id),
            }
        ),
        200,
    )


@bp.route("/unenroll-student", methods=["POST"])
@jwt_admin_required
def admin_unenroll_student():
    """Unenroll a student from a class (admin only)."""
    if not request.is_json:
        return jsonify({"msg": "Missing JSON in request"}), 400

    student_id = request.json.get("student_id")
    class_id = request.json.get("class_id")

    if not student_id or not class_id:
        return jsonify({"msg": "Student ID and Class ID are required"}), 400

    enrollment = db.session.get(User_Course, (student_id, class_id))
    if not enrollment:
        return jsonify({"msg": "Student is not enrolled in this class"}), 404

    student = db.session.get(User, student_id)
    course = db.session.get(Course, class_id)
    enrollment.delete()

    return (
        jsonify(
            {
                "msg": f"Student {student.name if student else student_id} removed from {course.name if course else class_id}",
                "student_id": int(student_id),
                "class_id": int(class_id),
            }
        ),
        200,
    )
