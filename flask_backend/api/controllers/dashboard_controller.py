# controllers/dashboard_controller.py

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity

from ..models import User, Course, Assignment, User_Course
from .auth_controller import jwt_teacher_required

bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@bp.route("/", methods=["GET"])
@jwt_teacher_required
def get_dashboard():
 
    email = get_jwt_identity()
    teacher = User.get_by_email(email)
    if not teacher:
        return jsonify({"msg": "User not found"}), 404

    classes = Course.get_courses_by_teacher(teacher.id)
    dashboard_data = []

    for c in classes:
        assignments = Assignment.get_by_class_id(c.id)

        assignment_list = [
            {
                "assignment_id": a.id,
                "name": a.name,
                "due_date": a.due_date.isoformat() if a.due_date else None,
            }
            for a in assignments
        ]

        # Count enrollments in the User_Courses join table
        students_count = User_Course.query.filter(
            User_Course.courseID == c.id
        ).count()

        dashboard_data.append(
            {
                "class_id": c.id,
                "class_name": c.name,
                "students_count": students_count,
                "assignments": assignment_list,
            }
        )

    return jsonify(
        {
            "teacher_id": teacher.id,
            "teacher_name": teacher.name,
            "dashboard": dashboard_data,
        }
    ), 200