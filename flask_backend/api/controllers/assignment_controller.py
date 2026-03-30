# api/controllers/assignment_controller.py

from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from ..models import (
    Course,
    Assignment,
    User,
    AssignmentSchema,
    CourseGroup,
    Group_Members,
    User_Course,
)
from ..models.db import db
from .auth_controller import jwt_teacher_required

bp = Blueprint("assignment", __name__, url_prefix="/assignment")


def _get_current_user():
    email = get_jwt_identity()
    if not email:
        return None
    return User.get_by_email(email)


def _is_assignment_owner(user_id: int, assignment: Assignment) -> bool:
    course = Course.get_by_id(assignment.courseID)
    return bool(course and course.teacherID == user_id)


@bp.route("/create_assignment", methods=["POST"])
@jwt_teacher_required
def create_assignment():

    data = request.get_json() or {}
    course_id = data.get("courseID")
    assignment_name = data.get("name")
    rubric_text = data.get("rubric")
    due_date = data.get("due_date")

    if not due_date:
        due_date = None
    else:
        due_date = datetime.fromisoformat(due_date)

    if not course_id:
        return jsonify({"msg": "Course ID is required"}), 400
    if not assignment_name:
        return jsonify({"msg": "Assignment name is required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(course_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    new_assignment = Assignment(
        courseID=course_id,
        name=assignment_name,
        rubric_text=rubric_text,
        due_date=due_date,
    )
    Assignment.create(new_assignment)

    return (
        jsonify(
            {
                "msg": "Assignment created",
                "assignment": AssignmentSchema().dump(new_assignment),
            }
        ),
        201,
    )


@bp.route("/edit_assignment/<int:assignment_id>", methods=["PATCH"])
@jwt_teacher_required
def edit_assignment(assignment_id):
    """Edit an existing assignment if the authenticated user is the teacher of the class and the due date has not passed"""
    data = request.get_json() or {}

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if course is None:
        return jsonify({"msg": "Course not found"}), 404

    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403


    assignment.name = data.get("name", assignment.name)
    assignment.rubric_text = data.get("rubric", assignment.rubric_text)
    due_date = data.get("due_date")
    if due_date:
        assignment.due_date = datetime.fromisoformat(due_date)

    assignment.update()
    return (
        jsonify(
            {
                "msg": "Assignment updated",
                "assignment": AssignmentSchema().dump(assignment),
            }
        ),
        200,
    )


@bp.route("/delete_assignment/<int:assignment_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_assignment(assignment_id):
   
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

   
    if assignment.due_date is not None:
        now = datetime.now()
        if assignment.due_date < now:
            return jsonify({"msg": "Assignment cannot be deleted after its due date"}), 400

    assignment.delete()
    return jsonify({"msg": "Assignment deleted"}), 200


@bp.route("/<int:class_id>", methods=["GET"])
@jwt_required()
def get_assignments(class_id):
    """Get all assignments for a given class"""
    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    assignments = Assignment.get_by_class_id(class_id)
    assignments_data = AssignmentSchema(many=True).dump(assignments)
    return jsonify(assignments_data), 200


@bp.route("/user_id", methods=["GET"])
@jwt_required()
def get_user_id():
    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user.id), 200


@bp.route("/<int:assignment_id>/members", methods=["GET"])
@jwt_teacher_required
def list_assignment_members(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _is_assignment_owner(user.id, assignment):
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    students = (
        db.session.query(User)
        .join(User_Course, User_Course.userID == User.id)
        .filter(User_Course.courseID == assignment.courseID)
        .filter(User.role == "student")
        .order_by(User.name.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "id": s.id,
                    "name": s.name,
                    "email": s.email,
                    "role": s.role,
                }
                for s in students
            ]
        ),
        200,
    )


@bp.route("/list_all_groups/<int:assignment_id>", methods=["GET"])
@jwt_required()
def list_all_groups(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    groups = (
        CourseGroup.query.filter(CourseGroup.assignmentID == assignment_id)
        .order_by(CourseGroup.id.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "id": g.id,
                    "name": g.name,
                    "assignmentID": g.assignmentID,
                }
                for g in groups
            ]
        ),
        200,
    )


@bp.route("/list_group_members/<int:assignment_id>/<int:group_id>", methods=["GET"])
@jwt_required()
def list_group_members(assignment_id, group_id):
    group = CourseGroup.get_by_id(group_id)
    if not group or group.assignmentID != assignment_id:
        return jsonify([]), 200

    memberships = (
        Group_Members.query.filter_by(assignmentID=assignment_id, groupID=group_id)
        .order_by(Group_Members.userID.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "userID": m.userID,
                    "groupID": m.groupID,
                    "assignmentID": m.assignmentID,
                }
                for m in memberships
            ]
        ),
        200,
    )


@bp.route("/list_ua_groups/<int:assignment_id>", methods=["GET"])
@jwt_required()
def list_unassigned_groups(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    grouped_user_ids = {
        user_id
        for (user_id,) in db.session.query(Group_Members.userID)
        .filter(Group_Members.assignmentID == assignment_id)
        .all()
    }

    students = (
        db.session.query(User)
        .join(User_Course, User_Course.userID == User.id)
        .filter(User_Course.courseID == assignment.courseID)
        .filter(User.role == "student")
        .order_by(User.name.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "userID": s.id,
                    "groupID": -1,
                    "assignmentID": assignment_id,
                }
                for s in students
                if s.id not in grouped_user_ids
            ]
        ),
        200,
    )


@bp.route("/list_stu_groups/<int:assignment_id>/<int:student_id>", methods=["GET"])
@jwt_required()
def list_student_group_members(assignment_id, student_id):
    membership = (
        Group_Members.query.filter_by(assignmentID=assignment_id, userID=student_id)
        .order_by(Group_Members.groupID.asc())
        .first()
    )

    if not membership:
        return jsonify([]), 200

    group_members = (
        Group_Members.query.filter_by(assignmentID=assignment_id, groupID=membership.groupID)
        .order_by(Group_Members.userID.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    "userID": m.userID,
                    "groupID": m.groupID,
                    "assignmentID": m.assignmentID,
                }
                for m in group_members
            ]
        ),
        200,
    )


@bp.route("/save_groups", methods=["POST"])
@jwt_teacher_required
def save_groups():
    data = request.get_json() or {}
    group_id = data.get("groupID")
    user_id = data.get("userID")
    assignment_id = data.get("assignmentID")

    if user_id is None or assignment_id is None or group_id is None:
        return jsonify({"msg": "groupID, userID, and assignmentID are required"}), 400

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _is_assignment_owner(user.id, assignment):
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    student = User.get_by_id(user_id)
    if not student or student.role != "student":
        return jsonify({"msg": "Student not found"}), 404

    enrollment = User_Course.get(user_id, assignment.courseID)
    if not enrollment:
        return jsonify({"msg": "Student is not enrolled in this assignment's class"}), 400

    db.session.query(Group_Members).filter(
        Group_Members.assignmentID == assignment_id,
        Group_Members.userID == user_id,
    ).delete(synchronize_session=False)

    if int(group_id) == -1:
        db.session.commit()
        return jsonify({"msg": "Student unassigned"}), 200

    group = CourseGroup.get_by_id(group_id)
    if not group or group.assignmentID != assignment_id:
        db.session.rollback()
        return jsonify({"msg": "Group not found for this assignment"}), 404

    db.session.add(
        Group_Members(userID=int(user_id), groupID=int(group_id), assignmentID=int(assignment_id))
    )
    db.session.commit()

    return jsonify({"msg": "Group assignment updated"}), 200


@bp.route("/delete_group", methods=["POST"])
@jwt_teacher_required
def delete_group():
    data = request.get_json() or {}
    group_id = data.get("groupID")
    if group_id is None:
        return jsonify({"msg": "groupID is required"}), 400

    group = CourseGroup.get_by_id(group_id)
    if not group:
        return jsonify({"msg": "Group not found"}), 404

    assignment = Assignment.get_by_id(group.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _is_assignment_owner(user.id, assignment):
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    db.session.query(Group_Members).filter(Group_Members.groupID == group.id).delete(
        synchronize_session=False
    )
    db.session.delete(group)
    db.session.commit()

    return jsonify({"msg": "Group deleted"}), 200


@bp.route("/next_groupid", methods=["GET"])
@jwt_required()
def next_group_id():
    assignment_id = request.args.get("assignmentID", type=int)
    if assignment_id is None:
        return jsonify({"msg": "assignmentID is required"}), 400

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    next_id = db.session.query(func.coalesce(func.max(CourseGroup.id), 0) + 1).scalar()
    return jsonify({"id": int(next_id)}), 200


@bp.route("/create_group", methods=["POST"])
@jwt_teacher_required
def create_group():
    data = request.get_json() or {}
    assignment_id = data.get("assignmentID")
    name = data.get("name")

    if not assignment_id:
        return jsonify({"msg": "assignmentID is required"}), 400

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    user = _get_current_user()
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if not _is_assignment_owner(user.id, assignment):
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    created_group = CourseGroup(name=(name or "").strip() or None, assignmentID=assignment_id)
    db.session.add(created_group)
    db.session.commit()

    return (
        jsonify(
            {
                "id": created_group.id,
                "name": created_group.name,
                "assignmentID": created_group.assignmentID,
            }
        ),
        201,
    )