"""Review controller for creating and retrieving reviews and criteria."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from ..models import (
    Assignment,
    Course,
    CriteriaDescription,
    Criterion,
    Review,
    Rubric,
    User,
    User_Course,
)
from .auth_controller import jwt_role_required

bp = Blueprint("review", __name__, url_prefix="")


@bp.route("/create_review", methods=["POST"])
@jwt_role_required("student", "teacher", "admin")
def create_review():
    """Create a review row for assignment/reviewer/reviewee."""
    data = request.get_json() or {}

    assignment_id = data.get("assignmentID")
    reviewer_id = data.get("reviewerID")
    reviewee_id = data.get("revieweeID")

    if assignment_id is None or reviewer_id is None or reviewee_id is None:
        return jsonify({"msg": "assignmentID, reviewerID, and revieweeID are required"}), 400

    try:
        assignment_id = int(assignment_id)
        reviewer_id = int(reviewer_id)
        reviewee_id = int(reviewee_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "assignmentID, reviewerID, and revieweeID must be integers"}), 400

    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    existing = Review.query.filter_by(
        assignmentID=assignment_id,
        reviewerID=reviewer_id,
        revieweeID=reviewee_id,
    ).first()
    if existing:
        return jsonify({"msg": "Review already exists", "id": existing.id}), 200

    review = Review(
        assignmentID=assignment_id,
        reviewerID=reviewer_id,
        revieweeID=reviewee_id,
    )
    Review.create_review(review)
    return jsonify({"msg": "Review created", "id": review.id}), 201


@bp.route("/create_criterion", methods=["POST"])
@jwt_role_required("student", "teacher", "admin")
def create_criterion():
    """Create a criterion score/comment row for a review."""
    data = request.get_json() or {}

    review_id = data.get("reviewID")
    criterion_row_id = data.get("criterionRowID")
    grade = data.get("grade")
    comments = data.get("comments")

    if review_id is None or criterion_row_id is None:
        return jsonify({"msg": "reviewID and criterionRowID are required"}), 400

    try:
        review_id = int(review_id)
        criterion_row_id = int(criterion_row_id)
        if grade is not None:
            grade = int(grade)
    except (ValueError, TypeError):
        return jsonify({"msg": "reviewID, criterionRowID, and grade must be integers"}), 400

    review = Review.get_by_id(review_id)
    if not review:
        return jsonify({"msg": "Review not found"}), 404

    criteria_desc = CriteriaDescription.get_by_id(criterion_row_id)
    if not criteria_desc:
        return jsonify({"msg": "Criteria description not found"}), 404

    existing = Criterion.query.filter_by(reviewID=review_id, criterionRowID=criterion_row_id).first()
    if existing:
        existing.grade = grade
        existing.comments = comments
        existing.update()
        return jsonify({"msg": "Criterion updated", "id": existing.id}), 200

    criterion = Criterion(
        reviewID=review_id,
        criterionRowID=criterion_row_id,
        grade=grade,
        comments=comments,
    )
    Criterion.create_criterion(criterion)
    return jsonify({"msg": "Criterion created", "id": criterion.id}), 201


@bp.route("/review", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_review():
    """Get a review and return rubric-aligned grades/comments for the frontend."""
    assignment_id = request.args.get("assignmentID")
    reviewer_id = request.args.get("reviewerID")
    reviewee_id = request.args.get("revieweeID")

    if assignment_id is None or reviewer_id is None or reviewee_id is None:
        return jsonify({"msg": "assignmentID, reviewerID, and revieweeID are required"}), 400

    try:
        assignment_id = int(assignment_id)
        reviewer_id = int(reviewer_id)
        reviewee_id = int(reviewee_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "assignmentID, reviewerID, and revieweeID must be integers"}), 400

    review = Review.query.filter_by(
        assignmentID=assignment_id,
        reviewerID=reviewer_id,
        revieweeID=reviewee_id,
    ).first()
    if not review:
        return jsonify({"id": None, "grades": [], "comments": []}), 200

    criteria = (
        Criterion.query.filter_by(reviewID=review.id)
        .order_by(Criterion.criterionRowID.asc())
        .all()
    )

    assignment = Assignment.get_by_id(assignment_id)
    rubric = (
        assignment.rubrics.order_by(Rubric.id.asc()).first()
        if assignment
        else None
    )

    if rubric:
        rubric_rows = rubric.criteria_descriptions.order_by(
            CriteriaDescription.id.asc()
        ).all()
        criterion_by_row = {
            criterion.criterionRowID: criterion for criterion in criteria
        }
        grades = [
            criterion_by_row.get(row.id).grade
            if criterion_by_row.get(row.id)
            else None
            for row in rubric_rows
        ]
        comments = [
            criterion_by_row.get(row.id).comments
            if criterion_by_row.get(row.id)
            else None
            for row in rubric_rows
        ]
    else:
        grades = [criterion.grade for criterion in criteria]
        comments = [criterion.comments for criterion in criteria]

    return jsonify({"id": review.id, "grades": grades, "comments": comments}), 200


@bp.route("/reviews/received", methods=["GET"])
@jwt_role_required("student", "teacher", "admin")
def get_received_reviews():
    """Get received reviews for a target student in an assignment.

    Students can only see their own received reviews and reviewer names are
    anonymized. Teachers/admins can view a specific student's received reviews
    with reviewer names visible.
    """
    assignment_id = request.args.get("assignmentID")
    requested_reviewee_id = request.args.get("revieweeID")

    if assignment_id is None:
        return jsonify({"msg": "assignmentID is required"}), 400

    try:
        assignment_id = int(assignment_id)
    except (ValueError, TypeError):
        return jsonify({"msg": "assignmentID must be an integer"}), 400

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

    is_teacher_or_admin = user.is_admin() or course.teacherID == user.id

    if is_teacher_or_admin:
        if requested_reviewee_id is None:
            return jsonify({"msg": "revieweeID is required"}), 400
        try:
            reviewee_id = int(requested_reviewee_id)
        except (ValueError, TypeError):
            return jsonify({"msg": "revieweeID must be an integer"}), 400
    else:
        enrollment = User_Course.get(user.id, course.id)
        if enrollment is None:
            return jsonify({"msg": "Unauthorized: You are not enrolled in this class"}), 403
        reviewee_id = user.id

    reviews = (
        Review.query.filter_by(assignmentID=assignment_id, revieweeID=reviewee_id)
        .order_by(Review.id.asc())
        .all()
    )

    rubric = assignment.rubrics.order_by(Rubric.id.asc()).first()
    rubric_rows = (
        rubric.criteria_descriptions.order_by(CriteriaDescription.id.asc()).all()
        if rubric
        else []
    )

    serialized_reviews = []
    for review in reviews:
        criteria_rows = (
            Criterion.query.filter_by(reviewID=review.id)
            .order_by(Criterion.criterionRowID.asc())
            .all()
        )

        criterion_by_row = {
            criterion.criterionRowID: criterion for criterion in criteria_rows
        }

        serialized_criteria = []
        if rubric_rows:
            for row in rubric_rows:
                criterion = criterion_by_row.get(row.id)
                serialized_criteria.append(
                    {
                        "id": criterion.id if criterion else None,
                        "criterionRowID": row.id,
                        "question": row.question,
                        "grade": criterion.grade if criterion else None,
                        "comments": criterion.comments if criterion else None,
                    }
                )
        else:
            for criterion in criteria_rows:
                criterion_desc = CriteriaDescription.get_by_id(criterion.criterionRowID)
                serialized_criteria.append(
                    {
                        "id": criterion.id,
                        "criterionRowID": criterion.criterionRowID,
                        "question": criterion_desc.question if criterion_desc else None,
                        "grade": criterion.grade,
                        "comments": criterion.comments,
                    }
                )

        reviewer = User.get_by_id(review.reviewerID)
        reviewer_name = (
            reviewer.name
            if (is_teacher_or_admin and reviewer)
            else "Anonymous"
        )

        serialized_reviews.append(
            {
                "id": review.id,
                "reviewerID": review.reviewerID,
                "revieweeID": review.revieweeID,
                "reviewerName": reviewer_name,
                "criteria": serialized_criteria,
            }
        )

    return (
        jsonify(
            {
                "assignmentID": assignment_id,
                "revieweeID": reviewee_id,
                "reviews": serialized_reviews,
            }
        ),
        200,
    )
