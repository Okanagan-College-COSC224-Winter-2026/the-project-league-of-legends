from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import (
    Rubric,
    CriteriaDescription,
    RubricSchema,
    CriteriaDescriptionSchema,
    Assignment,
    Course,
    User,
)
from .auth_controller import jwt_teacher_required

bp = Blueprint("rubric", __name__)


@bp.route("/create_rubric", methods=["POST"])
@jwt_teacher_required
def create_rubric():
    data = request.get_json() or {}
    assignment_id = data.get("assignmentID") or data.get("id")
    can_comment = data.get("canComment", True)

    if not assignment_id:
        return jsonify({"msg": "assignmentID is required"}), 400

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    new_rubric = Rubric(assignmentID=assignment_id, canComment=bool(can_comment))
    Rubric.create_rubric(new_rubric)

    return jsonify({"id": new_rubric.id}), 201


@bp.route("/create_criteria", methods=["POST"])
@jwt_teacher_required
def create_criteria():
    data = request.get_json() or {}
    rubric_id = data.get("rubricID")
    question = data.get("question")
    score_max = data.get("scoreMax")
    has_score = data.get("hasScore", True)

    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400

    rubric = Rubric.get_by_id(rubric_id)
    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    # Authorization: only teacher of the assignment's class can add criteria
    assignment = Assignment.get_by_id(rubric.assignmentID)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    course = Course.get_by_id(assignment.courseID)
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    new_criteria = CriteriaDescription(rubricID=rubric_id, question=question, scoreMax=score_max, hasScore=bool(has_score))
    CriteriaDescription.create_criteria_description(new_criteria)

    return jsonify({"id": new_criteria.id}), 201


@bp.route("/rubric", methods=["GET"])
@jwt_required()
def get_rubric():
    # Allow clients to fetch by Rubric.id (rubricID) or by Assignment.id (assignmentID)
    rubric_id = request.args.get("rubricID")
    assignment_id = request.args.get("assignmentID")

    if not rubric_id and not assignment_id:
        return jsonify({"msg": "rubricID or assignmentID query parameter required"}), 400

    rubric = None
    if rubric_id:
        rubric = Rubric.get_by_id(rubric_id)
    elif assignment_id:
        rubric = Rubric.query.filter_by(assignmentID=int(assignment_id)).first()

    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    return jsonify(RubricSchema().dump(rubric)), 200


@bp.route("/criteria", methods=["GET"])
@jwt_required()
def get_criteria():
    # Allow clients to fetch by Rubric.id (rubricID) or by Assignment.id (assignmentID)
    rubric_id = request.args.get("rubricID")
    assignment_id = request.args.get("assignmentID")

    if not rubric_id and not assignment_id:
        return jsonify({"msg": "rubricID or assignmentID query parameter required"}), 400

    rubric = None
    if rubric_id:
        rubric = Rubric.get_by_id(rubric_id)
    elif assignment_id:
        rubric = Rubric.query.filter_by(assignmentID=int(assignment_id)).first()

    if not rubric:
        return jsonify({"msg": "Rubric not found"}), 404

    criteria = rubric.criteria_descriptions.all()
    return jsonify(CriteriaDescriptionSchema(many=True).dump(criteria)), 200

@bp.route("/edit_rubric", methods=["PATCH"])
@jwt_teacher_required
def edit_rubric():
    data = request.get_json() or {}
    rubric_id = data.get("rubricID")
    if not rubric_id:
        return jsonify({"msg": "rubricID is required"}), 400

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
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    # Apply allowed updates
    if "canComment" in data:
        rubric.canComment = bool(data.get("canComment"))
    rubric.update()

    return jsonify({"msg": "Rubric updated", "rubric": RubricSchema().dump(rubric)}), 200


@bp.route("/delete_rubric/<int:rubric_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_rubric(rubric_id):
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
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    rubric.delete()
    return jsonify({"msg": "Rubric deleted"}), 200

@bp.route("/edit_criteria", methods=["PATCH"])
@jwt_teacher_required
def edit_criteria():
    data = request.get_json() or {}
    criteria_id = data.get("criteriaID")
    
    if not criteria_id:
        return jsonify({"msg": "criteriaID is required"}), 400

    criteria = CriteriaDescription.get_by_id(criteria_id)
    if not criteria:
        return jsonify({"msg": "Criteria not found"}), 404

    rubric = Rubric.get_by_id(criteria.rubricID)
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
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    # Apply allowed updates
    if "question" in data:
        criteria.question = data.get("question")
    if "scoreMax" in data:
        criteria.scoreMax = int(data.get("scoreMax"))
    
    criteria.update()

    return jsonify({"msg": "Criteria updated", "criteria": CriteriaDescriptionSchema().dump(criteria)}), 200


@bp.route("/delete_criteria/<int:criteria_id>", methods=["DELETE"])
@jwt_teacher_required
def delete_criteria(criteria_id):
    criteria = CriteriaDescription.get_by_id(criteria_id)
    if not criteria:
        return jsonify({"msg": "Criteria not found"}), 404

    rubric = Rubric.get_by_id(criteria.rubricID)
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
    if not course:
        return jsonify({"msg": "Class not found"}), 404
    if course.teacherID != user.id:
        return jsonify({"msg": "Unauthorized: You are not the teacher of this class"}), 403

    criteria.delete()
    return jsonify({"msg": "Criteria deleted"}), 200