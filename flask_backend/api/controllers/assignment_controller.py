import os
import mimetypes
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..models import (
    Assignment,
    AssignmentSchema,
    Course,
    Group_Members,
    Submission,
    User,
    SubmissionSchema,
    Group_Members,
    User_Course,
    db,
)
from .auth_controller import jwt_teacher_required

bp = Blueprint("assignment", __name__, url_prefix="/assignment")


def ensure_upload_dir(path):
    os.makedirs(path, exist_ok=True)


def allowed_file(filename):
    return bool(filename and "." in filename and secure_filename(filename))


def is_student_in_course(user_id, course_id):
    return User_Course.get(user_id, course_id) is not None


def get_group_member_ids_for_assignment(assignment_id, user_id):
    membership = Group_Members.query.filter_by(
        userID=user_id,
        assignmentID=assignment_id,
    ).first()

    if not membership:
        return [user_id], None

    members = Group_Members.query.filter_by(
        groupID=membership.groupID,
        assignmentID=assignment_id,
    ).all()
    member_ids = [member.userID for member in members]
    return member_ids, membership.groupID


def get_group_submission(assignment_id, member_ids):
    if not member_ids:
        return None

    return (
        Submission.query.filter(
            Submission.assignmentID == assignment_id,
            Submission.studentID.in_(member_ids),
        )
        .order_by(Submission.id.desc())
        .first()
    )


def original_filename_from_path(path):
    if not path:
        return None

    filename = os.path.basename(path)
    parts = filename.split("_", 1)
    if len(parts) == 2 and parts[0].isdigit():
        return parts[1]
    return filename


def send_download_file(path, download_name):
    guessed_type, _ = mimetypes.guess_type(download_name or path)
    send_kwargs = {
        "as_attachment": True,
        "download_name": download_name,
    }
    if guessed_type:
        send_kwargs["mimetype"] = guessed_type

    return send_file(path, **send_kwargs)


def submission_to_dict(submission):
    if not submission:
        return None

    submitted_at = None
    if submission.path and os.path.exists(submission.path):
        submitted_at = datetime.fromtimestamp(os.path.getmtime(submission.path)).isoformat()

    student = User.get_by_id(submission.studentID)
    return {
        "id": submission.id,
        "studentID": submission.studentID,
        "assignmentID": submission.assignmentID,
        "file_name": original_filename_from_path(submission.path),
        "file_path": submission.path,
        "submitted_at": submitted_at,
        "student_name": student.name if student else None,
    }


def get_group_member_ids_for_assignment(assignment_id, user_id):
    membership = Group_Members.query.filter_by(
        assignmentID=assignment_id,
        userID=user_id,
    ).first()

    if not membership:
        return [user_id], None

    members = Group_Members.query.filter_by(
        assignmentID=assignment_id,
        groupID=membership.groupID,
    ).all()
    member_ids = [member.userID for member in members]
    return member_ids, membership.groupID


def get_group_submission(assignment_id, member_ids):
    if not member_ids:
        return None

    return (
        Submission.query.filter(
            Submission.assignmentID == assignment_id,
            Submission.studentID.in_(member_ids),
        )
        .order_by(Submission.id.desc())
        .first()
    )


@bp.route("/create_assignment", methods=["POST"])
@jwt_teacher_required
def create_assignment():
    data = request.get_json(silent=True) or request.form
    course_id = data.get("courseID")
    assignment_name = data.get("name")
    rubric_text = data.get("rubric")
    due_date = data.get("due_date")
    teacher_file = request.files.get("file")

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

    attachment_filename = None
    attachment_path = None

    if teacher_file:
        if teacher_file.filename == "":
            return jsonify({"msg": "No selected file"}), 400

        if not allowed_file(teacher_file.filename):
            return jsonify({"msg": "File type not allowed"}), 400

        safe_name = secure_filename(teacher_file.filename)
        upload_dir = os.path.join(
            current_app.config["UPLOAD_FOLDER"],
            "assignments",
            str(course_id),
        )
        ensure_upload_dir(upload_dir)

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        stored_name = f"{timestamp}_{safe_name}"
        full_path = os.path.join(upload_dir, stored_name)
        teacher_file.save(full_path)

        attachment_filename = safe_name
        attachment_path = full_path

    new_assignment = Assignment(
        courseID=course_id,
        name=assignment_name,
        rubric_text=rubric_text,
        due_date=due_date,
        attachment_filename=attachment_filename,
        attachment_path=attachment_path,
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

    if not assignment.can_modify():
        return jsonify({"msg": "Assignment cannot be edited after its due date"}), 400

    data = request.get_json(silent=True) or request.form
    assignment.name = data.get("name", assignment.name)
    assignment.rubric_text = data.get("rubric", assignment.rubric_text)

    due_date = data.get("due_date")
    if due_date:
        assignment.due_date = datetime.fromisoformat(due_date)

    teacher_file = request.files.get("file")
    if teacher_file:
        if teacher_file.filename == "":
            return jsonify({"msg": "No selected file"}), 400

        if not allowed_file(teacher_file.filename):
            return jsonify({"msg": "File type not allowed"}), 400

        safe_name = secure_filename(teacher_file.filename)
        upload_dir = os.path.join(
            current_app.config["UPLOAD_FOLDER"],
            "assignments",
            str(course.id),
        )
        ensure_upload_dir(upload_dir)

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        stored_name = f"{timestamp}_{safe_name}"
        full_path = os.path.join(upload_dir, stored_name)
        teacher_file.save(full_path)

        if assignment.attachment_path and os.path.exists(assignment.attachment_path):
            os.remove(assignment.attachment_path)

        assignment.attachment_filename = safe_name
        assignment.attachment_path = full_path

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

    if not assignment.can_modify():
        return jsonify({"msg": "Assignment cannot be deleted after its due date"}), 400

    if assignment.attachment_path and os.path.exists(assignment.attachment_path):
        os.remove(assignment.attachment_path)

    submissions = Submission.query.filter_by(assignmentID=assignment.id).all()
    for submission in submissions:
        if submission.path and os.path.exists(submission.path):
            os.remove(submission.path)
        db.session.delete(submission)

    db.session.commit()
    assignment.delete()
    return jsonify({"msg": "Assignment deleted"}), 200


@bp.route("/<int:class_id>", methods=["GET"])
@jwt_required()
def get_assignments(class_id):
    course = Course.get_by_id(class_id)
    if not course:
        return jsonify({"msg": "Class not found"}), 404

    assignments = Assignment.get_by_class_id(class_id)
    assignments_data = AssignmentSchema(many=True).dump(assignments)
    return jsonify(assignments_data), 200


@bp.route("/details/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    assignment_data = AssignmentSchema().dump(assignment)
    return jsonify(assignment_data), 200


@bp.route("/download_assignment_file/<int:assignment_id>", methods=["GET"])
@jwt_required()
def download_assignment_file(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    if not assignment.attachment_path:
        return jsonify({"msg": "No file attached to this assignment"}), 404

    if not os.path.exists(assignment.attachment_path):
        return jsonify({"msg": "File not found on server"}), 404

    return send_download_file(
        assignment.attachment_path,
        assignment.attachment_filename,
    )


@bp.route("/submit/<int:assignment_id>", methods=["POST"])
@jwt_required()
def submit_assignment(assignment_id):
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

    if user.id == course.teacherID:
        return jsonify({"msg": "Teachers cannot submit assignments"}), 403

    if not is_student_in_course(user.id, course.id):
        return jsonify({"msg": "You are not enrolled in this class"}), 403

    submission_file = request.files.get("file")
    if not submission_file:
        return jsonify({"msg": "Submission file is required"}), 400

    if submission_file.filename == "":
        return jsonify({"msg": "No selected file"}), 400

    if not allowed_file(submission_file.filename):
        return jsonify({"msg": "File type not allowed"}), 400

    group_member_ids, group_id = get_group_member_ids_for_assignment(
        assignment.id,
        user.id,
    )

    safe_name = secure_filename(submission_file.filename)
    upload_dir = os.path.join(
        current_app.config["UPLOAD_FOLDER"],
        "submissions",
        str(assignment.id),
        str(group_id) if group_id is not None else str(user.id),
    )
    ensure_upload_dir(upload_dir)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    stored_name = f"{timestamp}_{safe_name}"
    full_path = os.path.join(upload_dir, stored_name)
    submission_file.save(full_path)

    existing_submission = (
        get_group_submission(assignment.id, group_member_ids)
        if group_member_ids
        else Submission.get_by_student_and_assignment(
            user.id,
            assignment.id,
        )
    )

    if existing_submission:
        if existing_submission.path and os.path.exists(existing_submission.path):
            os.remove(existing_submission.path)

        existing_submission.path = full_path
        existing_submission.studentID = user.id
        existing_submission.update()

        return jsonify(
            {
                "msg": "Submission updated",
                "submission": submission_to_dict(existing_submission),
            }
        ), 200

    new_submission = Submission(
        path=full_path,
        studentID=user.id,
        assignmentID=assignment.id,
    )
    Submission.create_submission(new_submission)

    return jsonify(
        {
            "msg": "Submission uploaded",
            "submission": submission_to_dict(new_submission),
        }
    ), 201


@bp.route("/my_submission/<int:assignment_id>", methods=["GET"])
@jwt_required()
def get_my_submission(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    group_member_ids, _ = get_group_member_ids_for_assignment(assignment_id, user.id)
    submission = get_group_submission(assignment_id, group_member_ids)
    if not submission:
        group_member_ids, _ = get_group_member_ids_for_assignment(
            assignment_id,
            user.id,
        )
        submission = get_group_submission(
            assignment_id,
            group_member_ids,
        )

    if not submission:
        return jsonify({"msg": "No submission found"}), 404

    return jsonify(submission_to_dict(submission)), 200


@bp.route("/download_my_submission/<int:assignment_id>", methods=["GET"])
@jwt_required()
def download_my_submission(assignment_id):
    assignment = Assignment.get_by_id(assignment_id)
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    email = get_jwt_identity()
    user = User.get_by_email(email)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    group_member_ids, _ = get_group_member_ids_for_assignment(assignment_id, user.id)
    submission = get_group_submission(assignment_id, group_member_ids)
    if not submission:
        group_member_ids, _ = get_group_member_ids_for_assignment(
            assignment_id,
            user.id,
        )
        submission = get_group_submission(
            assignment_id,
            group_member_ids,
        )

    if not submission:
        return jsonify({"msg": "No submission found"}), 404

    if not submission.path or not os.path.exists(submission.path):
        return jsonify({"msg": "Submission file not found"}), 404

    return send_download_file(
        submission.path,
        original_filename_from_path(submission.path),
    )


@bp.route("/submissions/<int:assignment_id>", methods=["GET"])
@jwt_teacher_required
def list_submissions(assignment_id):
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

    submissions = Submission.query.filter_by(assignmentID=assignment_id).all()
    payload = sorted(
        [submission_to_dict(submission) for submission in submissions],
        key=lambda item: item.get("submitted_at") or "",
        reverse=True,
    )
    return jsonify(payload), 200


@bp.route("/download_submission/<int:assignment_id>/<int:student_id>", methods=["GET"])
@jwt_teacher_required
def download_student_submission(assignment_id, student_id):
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

    group_member_ids, _ = get_group_member_ids_for_assignment(assignment_id, student_id)
    submission = get_group_submission(assignment_id, group_member_ids)
    if not submission:
        return jsonify({"msg": "Submission not found"}), 404

    if not submission.path or not os.path.exists(submission.path):
        return jsonify({"msg": "Submission file not found"}), 404

    return send_download_file(
        submission.path,
        original_filename_from_path(submission.path),
    )
