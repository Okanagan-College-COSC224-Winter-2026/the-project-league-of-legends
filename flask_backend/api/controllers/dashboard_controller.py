# controllers/dashboard_controller.py

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity

from ..models import (
    Assignment,
    Course,
    CourseGroup,
    Group_Members,
    Review,
    Submission,
    User,
    User_Course,
)
from ..models.db import db
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


@bp.route("/assignment-progress", methods=["GET"])
@jwt_teacher_required
def get_assignment_progress():
    """Return assignment progress grouped by course for teacher dashboard views."""
    email = get_jwt_identity()
    teacher = User.get_by_email(email)
    if not teacher:
        return jsonify({"msg": "User not found"}), 404

    courses = Course.get_courses_by_teacher(teacher.id)
    payload = []

    for course in courses:
        students = (
            db.session.query(User)
            .join(User_Course, User_Course.userID == User.id)
            .filter(User_Course.courseID == course.id)
            .filter(User.role == "student")
            .order_by(User.name.asc())
            .all()
        )

        assignments = (
            Assignment.query.filter(Assignment.courseID == course.id)
            .order_by(Assignment.id.asc())
            .all()
        )

        assignment_payload = []
        for assignment in assignments:
            submitted_student_ids = {
                s_id
                for (s_id,) in db.session.query(Submission.studentID)
                .filter(Submission.assignmentID == assignment.id)
                .all()
            }

            student_progress = [
                {
                    "student_id": student.id,
                    "student_name": student.name,
                    "submission_status": (
                        "submitted"
                        if student.id in submitted_student_ids
                        else "not_submitted"
                    ),
                }
                for student in students
            ]

            groups = (
                CourseGroup.query.filter(CourseGroup.assignmentID == assignment.id)
                .order_by(CourseGroup.name.asc(), CourseGroup.id.asc())
                .all()
            )
            group_ids = [g.id for g in groups]

            memberships = []
            if group_ids:
                memberships = (
                    db.session.query(Group_Members.groupID, User.id, User.name)
                    .join(User, User.id == Group_Members.userID)
                    .filter(Group_Members.groupID.in_(group_ids))
                    .order_by(Group_Members.groupID.asc(), User.name.asc())
                    .all()
                )

            members_by_group = {}
            for group_id, user_id, user_name in memberships:
                members_by_group.setdefault(group_id, []).append(
                    {"user_id": user_id, "user_name": user_name}
                )

            reviewed_reviewee_ids = {
                reviewee_id
                for (reviewee_id,) in db.session.query(Review.revieweeID)
                .filter(Review.assignmentID == assignment.id)
                .all()
            }

            group_progress = []
            for group in groups:
                members = members_by_group.get(group.id, [])
                member_ids = {m["user_id"] for m in members}
                reviewed_member_count = len(member_ids.intersection(reviewed_reviewee_ids))
                total_members = len(member_ids)

                if total_members == 0:
                    evaluation_status = "no_members"
                elif reviewed_member_count == 0:
                    evaluation_status = "not_evaluated"
                elif reviewed_member_count < total_members:
                    evaluation_status = "partially_evaluated"
                else:
                    evaluation_status = "evaluated"

                group_progress.append(
                    {
                        "group_id": group.id,
                        "group_name": group.name or f"Group {group.id}",
                        "evaluation_status": evaluation_status,
                        "reviewed_member_count": reviewed_member_count,
                        "total_members": total_members,
                        "members": members,
                    }
                )

            assignment_payload.append(
                {
                    "assignment_id": assignment.id,
                    "assignment_name": assignment.name,
                    "due_date": (
                        assignment.due_date.isoformat() if assignment.due_date else None
                    ),
                    "student_progress": student_progress,
                    "group_progress": group_progress,
                }
            )

        payload.append(
            {
                "course_id": course.id,
                "course_name": course.name,
                "assignments": assignment_payload,
            }
        )

    return jsonify({"courses": payload}), 200