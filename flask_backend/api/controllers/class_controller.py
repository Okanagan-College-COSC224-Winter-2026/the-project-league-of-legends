from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import joinedload
from werkzeug.security import generate_password_hash

from ..models import (
    Assignment,
    Course,
    CourseGroup,
    CourseSearchSchema,
    CriteriaDescription,
    Criterion,
    Group_Members,
    Review,
    Rubric,
    Submission,
    User,
    User_Course,
)
from ..models.db import db
from .auth_controller import jwt_teacher_required

import re
import csv
import io
from typing import List, Dict

bp = Blueprint("class", __name__, url_prefix="/class")

REQUIRED_HEADERS = {"id", "name", "email"}


def csv_to_list(csv_text: str):
    rows: List[Dict[str, str]] = []
    errors: List[str] = []

    if not csv_text or not csv_text.strip():
        return rows, ["CSV text empty"]

    stream = io.StringIO(csv_text.strip())

    try:
        reader = csv.DictReader(stream)
    except Exception as e:
        return rows, [f"Failed to read CSV: {e}"]

    headers = {h.strip() for h in reader.fieldnames or []}
    missing = REQUIRED_HEADERS - headers

    if missing:
        errors.append(f"Missing required headers: {', '.join(sorted(missing))}")
        return rows, errors

    for line_num, row in enumerate(reader, start=2):
        if row is None:
            continue

        normalized = {
            k.strip(): (v.strip() if isinstance(v, str) else "")
            for k, v in row.items()
        }

        if not any(normalized.values()):
            continue

        if any(not normalized[field] for field in REQUIRED_HEADERS):
            errors.append(f"Line {line_num}: Missing required fields")
            continue

        rows.append(
            {
                "id": normalized["id"],
                "name": normalized["name"],
                "email": normalized["email"],
            }
        )

    return rows, errors


@bp.route("/create_class", methods=["POST"])
@jwt_teacher_required
def create_class():
    data = request.get_json() or {}
    class_name = data.get("name")

    if not class_name:
        return jsonify({"msg": "Class name is required"}), 400
  

    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    existing_class = Course.get_by_name(class_name)
    if existing_class:
        return jsonify({"msg": "Class already exists"}), 400

    new_class = Course(teacherID=user.id, name=class_name)

    db.session.add(new_class)
    db.session.commit()

    return jsonify({"msg": "Class created", "class": {"id": new_class.id}}), 201


@bp.route("/browse_classes", methods=["GET"])
@jwt_required()
def get_classes():
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    classes = Course.query.all()

    return jsonify([{"id": c.id, "name": c.name} for c in classes]), 200


@bp.route("/classes", methods=["GET"])
@jwt_required()
def get_user_classes():
    email = get_jwt_identity()
    user = User.get_by_email(email)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    if user.is_teacher():
        courses = Course.get_courses_by_teacher(user.id)
    elif user.is_admin():
        courses = Course.query.all()
    elif user.is_student():
        user_courses = User_Course.get_courses_by_student(user.id)
        courses = [Course.get_by_id(uc.courseID) for uc in user_courses]
        courses = [c for c in courses if c is not None]
    else:
        courses = []

    return jsonify([{"id": c.id, "name": c.name} for c in courses]), 200


# ── Course search (US-17) ──────────────────────────────────

search_schema = CourseSearchSchema(many=True)


def _matches_query(course_name: str, tokens: list[str]) -> bool:
    """Return True when every search token appears in the course name
    (case-insensitive, order-independent)."""
    lower_name = course_name.lower()
    return all(token in lower_name for token in tokens)


@bp.route("/search_course", methods=["GET"])
@jwt_required()
def search_courses():
    """Search courses by name.

    - Admin:   searches all courses
    - Teacher: searches own courses only
    - Student: searches enrolled courses only

    Query params:
        q (str): space-separated search tokens (order-independent).
                 Each token must appear in the course name.
                 Empty / missing returns all courses within scope.

    Returns:
        200: list of matching courses with teacher_name
    """
    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # ── build base query scoped by role ──
    if user.is_admin():
        query = Course.query.options(joinedload(Course.teacher))
    elif user.is_teacher():
        query = (
            Course.query.options(joinedload(Course.teacher))
            .filter(Course.teacherID == user.id)
        )
    elif user.is_student():
        query = (
            Course.query.options(joinedload(Course.teacher))
            .join(User_Course, User_Course.courseID == Course.id)
            .filter(User_Course.userID == user.id)
        )
    else:
        # Fallback for any unrecognised role — return empty list as a safe default
        return jsonify([]), 200

    courses = query.all()

    # ── apply text search in Python ──
    raw_q = request.args.get("q", "").strip()
    if raw_q:
        tokens = [t.lower() for t in raw_q.split() if t]
        courses = [c for c in courses if _matches_query(c.name or "", tokens)]

    return search_schema.jsonify(courses), 200


@bp.route("/<int:class_id>/members", methods=["GET"])
@jwt_required()
def get_class_members(class_id: int):
    course = Course.query.get(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    email = get_jwt_identity()
    requester = User.get_by_email(email)
    if not requester:
        return jsonify({"msg": "User not found"}), 404

    # Allow any enrolled user (student, teacher, admin) to view members
    # Optionally, you could check if the requester is enrolled in the course
    # For now, allow all authenticated users

    members = (
        db.session.query(User)
        .join(User_Course, User_Course.userID == User.id)
        .filter(User_Course.courseID == class_id)
        .all()
    )

    return (
        jsonify(
            [
                {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                    "role": getattr(u, "role", None),
                }
                for u in members
            ]
        ),
        200,
    )


@bp.route("/delete_class/<int:class_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_class(class_id):
    try:
        course = Course.query.get(class_id)
        if not course:
            return jsonify({"msg": "Class not found"}), 404

        email = get_jwt_identity()
        user = User.get_by_email(email)
        if not user:
            return jsonify({"msg": "User not found"}), 404

        if course.teacherID != user.id:
            return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

        db.session.execute(
            User_Course.__table__.delete().where(User_Course.courseID == class_id)
        )
        db.session.flush()

        assignment_ids = [
            a_id
            for (a_id,) in db.session.query(Assignment.id)
            .filter(Assignment.courseID == class_id)
            .all()
        ]

        if assignment_ids:
            group_ids = [
                g_id
                for (g_id,) in db.session.query(CourseGroup.id)
                .filter(CourseGroup.assignmentID.in_(assignment_ids))
                .all()
            ]

            if group_ids:
                db.session.query(Group_Members).filter(
                    Group_Members.groupID.in_(group_ids)
                ).delete(synchronize_session=False)

                db.session.query(CourseGroup).filter(
                    CourseGroup.id.in_(group_ids)
                ).delete(synchronize_session=False)

            review_ids = [
                r_id
                for (r_id,) in db.session.query(Review.id)
                .filter(Review.assignmentID.in_(assignment_ids))
                .all()
            ]

            if review_ids:
                db.session.query(Criterion).filter(
                    Criterion.reviewID.in_(review_ids)
                ).delete(synchronize_session=False)

                db.session.query(Review).filter(
                    Review.id.in_(review_ids)
                ).delete(synchronize_session=False)

            rubric_ids = [
                rb_id
                for (rb_id,) in db.session.query(Rubric.id)
                .filter(Rubric.assignmentID.in_(assignment_ids))
                .all()
            ]

            if rubric_ids:
                db.session.query(CriteriaDescription).filter(
                    CriteriaDescription.rubricID.in_(rubric_ids)
                ).delete(synchronize_session=False)

                db.session.query(Rubric).filter(
                    Rubric.id.in_(rubric_ids)
                ).delete(synchronize_session=False)

            db.session.query(Submission).filter(
                Submission.assignmentID.in_(assignment_ids)
            ).delete(synchronize_session=False)

            db.session.query(Assignment).filter(
                Assignment.id.in_(assignment_ids)
            ).delete(synchronize_session=False)

        db.session.query(Course).filter(
            Course.id == class_id
        ).delete(synchronize_session=False)

        db.session.commit()
        return jsonify({"msg": "Class deleted"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Delete class failed", "error": str(e)}), 500


@bp.route("/enroll_students", methods=["POST"])
@jwt_teacher_required
def enroll_students():
    data = request.get_json() or {}
    class_id = data.get("class_id")
    student_emails_csv = data.get("students", "")

    if not class_id or not student_emails_csv:
        return jsonify({"msg": "Class ID and student emails are required"}), 400

    course = Course.query.get(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if course.teacherID != user.id:
        return jsonify({"msg": "You are not authorized to enroll students in this class"}), 403

    students, parse_errors = csv_to_list(student_emails_csv)
    if parse_errors:
        return jsonify({"msg": "Errors in CSV", "errors": parse_errors}), 400

    enrolled_students = []

    for student_info in students:
        student_email = (student_info["email"] or "").strip().lower()

        if not re.match(r"[^@]+@[^@]+\.[^@]+", student_email):
            return jsonify({"msg": f"Invalid email format: {student_email}"}), 400

        name = student_info["name"]
        student = User.get_by_email(student_email)

        # If student already has an account, set role to student and DO NOT overwrite password.
        # If they don't exist, create a placeholder roster account.
        if not student:
            student = User(
                name=name,
                email=student_email,
                hash_pass=generate_password_hash("password123"),
                role="student",
                must_change_password=True,
            )
            db.session.add(student)
            db.session.commit()
        else:
            # Update role to student if not already
            if student.role != "student":
                student.role = "student"
                db.session.commit()

        enrollment = User_Course.get(student.id, class_id)
        if not enrollment:
            User_Course.add(student.id, class_id)
            enrolled_students.append(student_email)

    return jsonify({"msg": f"{len(enrolled_students)} students added to course {course.name}"}), 200