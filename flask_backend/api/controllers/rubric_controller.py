"""
Rubric controller for creating and managing rubrics and their criteria.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from ..models import (
    Assignment,
    Course,
    Rubric,
    CriteriaDescription,
    User,
    RubricSchema,
    CriteriaDescriptionSchema,
)
from .auth_controller import jwt_teacher_required

bp = Blueprint("rubric", __name__, url_prefix="")


@bp.route("/create_rubric", methods=["POST"])
@jwt_teacher_required
def create_rubric():
    """Create a new rubric for an assignment"""
    data = request.get_json()
    assignment_id = data.get("assignmentID")
    can_comment = data.get("canComment", True)

    if not assignment_id:
        return jsonify({"msg": "assignmentID is required"}), 400

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Course not found"}), 404

    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403
    # Delete existing rubric with same ID if it exists (as per endpoint spec)
    existing = Rubric.query.filter_by(assignmentID=assignment_id).first()
    if existing:
        existing.delete()
    new_rubric = Rubric(assignmentID=assignment_id, canComment=can_comment)
    Rubric.create_rubric(new_rubric)

    return jsonify({"msg": "Rubric created", "id": new_rubric.id}), 201


@bp.route("/create_criteria", methods=["POST"])
@jwt_teacher_required
def create_criteria():
    """Create criteria descriptions for a rubric"""
    data = request.get_json()
    rubric_id = data.get("rubricID")
    question = data.get("question")
    score_max = data.get("scoreMax")
    has_score = data.get("hasScore", True)

    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400
    if not question or not str(question).strip():
        return jsonify({"msg": "question is required and cannot be empty"}), 400

    rubric = Rubric.get_by_id(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    assignment = Assignment.get_by_id(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    new_criteria = CriteriaDescription(
        rubricID=rubric_id, question=question, scoreMax=score_max, hasScore=has_score
    )
    CriteriaDescription.create_criteria_description(new_criteria)

    return (
        jsonify({"msg": "Criteria created", "id": new_criteria.id}),
        201,
    )


@bp.route("/rubric", methods=["GET"])
def get_rubric():
    """Get a rubric by ID"""
    rubric_id = request.args.get("rubricID")

    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400

    try:
        rubric_id = int(rubric_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "rubricID must be an integer"}), 400

    rubric = Rubric.get_by_id(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    schema = RubricSchema()
    return jsonify(schema.dump(rubric)), 200


@bp.route("/criteria", methods=["GET"])
def get_criteria():
    """Get all criteria descriptions for a rubric"""
    rubric_id = request.args.get("rubricID")

    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400

    try:
        rubric_id = int(rubric_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "rubricID must be an integer"}), 400

    rubric = Rubric.get_by_id(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    criteria_list = CriteriaDescription.query.filter_by(rubricID=rubric_id).all()
    schema = CriteriaDescriptionSchema(many=True)
    return jsonify(schema.dump(criteria_list)), 200


@bp.route("/delete_rubric", methods=["POST"])
@jwt_teacher_required
def delete_rubric():
    """Delete a rubric by ID"""
    data = request.get_json()
    rubric_id = data.get("rubricID")

    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400

    try:
        rubric_id = int(rubric_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "rubricID must be an integer"}), 400

    rubric = Rubric.get_by_id(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    assignment = Assignment.get_by_id(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    # delete the rubric (cascade will remove criteria)
    rubric.delete()

    return jsonify({"msg": "Rubric deleted", "id": rubric_id}), 200
    