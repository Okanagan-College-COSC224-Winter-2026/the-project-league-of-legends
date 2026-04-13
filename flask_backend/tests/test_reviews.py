"""
Tests for student peer review endpoints:
  POST /create_review
  POST /create_criterion
  GET  /review
"""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models.db import db as _db
from api.models import User, User_Course


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def review_setup(test_client, make_admin):
    """
    Creates:
      - a teacher who owns a course + assignment + rubric + one criterion
      - two student users
    Returns a dict of their IDs and logs student1 in.
    """
    # --- teacher ---
    make_admin(email="teacher@rev.com", password="teacher", name="Rev Teacher")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@rev.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_resp = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Rev Course"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_resp.json["class"]["id"]

    assign_resp = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": class_id, "name": "Peer Eval"}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assign_resp.json["assignment"]["id"]

    rubric_resp = test_client.post(
        "/create_rubric",
        data=json.dumps({"assignmentID": assignment_id, "canComment": False}),
        headers={"Content-Type": "application/json"},
    )
    rubric_id = rubric_resp.json["id"]

    crit_resp = test_client.post(
        "/create_criteria",
        data=json.dumps(
            {"rubricID": rubric_id, "question": "Teamwork", "scoreMax": 5, "hasScore": True}
        ),
        headers={"Content-Type": "application/json"},
    )
    criterion_desc_id = crit_resp.json["id"]

    # --- students ---
    s1 = User(
        name="Student One",
        email="s1@rev.com",
        hash_pass=generate_password_hash("pass"),
        role="student",
    )
    s2 = User(
        name="Student Two",
        email="s2@rev.com",
        hash_pass=generate_password_hash("pass"),
        role="student",
    )
    _db.session.add(s1)
    _db.session.add(s2)
    _db.session.commit()

    # Enroll both students into the course for access-control checks.
    _db.session.add(User_Course(userID=s1.id, courseID=class_id))
    _db.session.add(User_Course(userID=s2.id, courseID=class_id))
    _db.session.commit()

    # log student1 in for subsequent requests
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "s1@rev.com", "password": "pass"}),
        headers={"Content-Type": "application/json"},
    )

    return {
        "assignment_id": assignment_id,
        "rubric_id": rubric_id,
        "criterion_desc_id": criterion_desc_id,
        "student1_id": s1.id,
        "student2_id": s2.id,
    }


# ---------------------------------------------------------------------------
# POST /create_review
# ---------------------------------------------------------------------------


def test_create_review_success(test_client, review_setup):
    """Student can create a review for a groupmate."""
    data = review_setup
    resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 201
    assert resp.json["msg"] == "Review created"
    assert isinstance(resp.json["id"], int)


def test_create_review_duplicate_returns_existing(test_client, review_setup):
    """Creating the same review twice returns the existing row (200, not 201)."""
    data = review_setup
    payload = json.dumps(
        {
            "assignmentID": data["assignment_id"],
            "reviewerID": data["student1_id"],
            "revieweeID": data["student2_id"],
        }
    )
    headers = {"Content-Type": "application/json"}
    test_client.post("/create_review", data=payload, headers=headers)
    resp = test_client.post("/create_review", data=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json["msg"] == "Review already exists"
    assert isinstance(resp.json["id"], int)


def test_create_review_missing_fields(test_client, review_setup):
    """Missing required fields returns 400."""
    resp = test_client.post(
        "/create_review",
        data=json.dumps({"assignmentID": review_setup["assignment_id"]}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


def test_create_review_invalid_assignment(test_client, review_setup):
    """Non-existent assignment returns 404."""
    data = review_setup
    resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": 99999,
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 404


def test_create_review_unauthenticated(test_client, review_setup):
    """Unauthenticated request is rejected."""
    test_client.post("/auth/logout", headers={"Content-Type": "application/json"})
    data = review_setup
    resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /create_criterion
# ---------------------------------------------------------------------------


def test_create_criterion_success(test_client, review_setup):
    """Student can submit a criterion score for a review."""
    data = review_setup

    # first create the review
    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]

    # now create the criterion using the real DB criterion_desc_id
    resp = test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": review_id,
                "criterionRowID": data["criterion_desc_id"],
                "grade": 4,
                "comments": "Great teamwork",
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 201
    assert resp.json["msg"] == "Criterion created"
    assert isinstance(resp.json["id"], int)


def test_create_criterion_updates_existing(test_client, review_setup):
    """Submitting a criterion for the same review+row updates the existing row."""
    data = review_setup

    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]

    payload = {
        "reviewID": review_id,
        "criterionRowID": data["criterion_desc_id"],
        "grade": 3,
        "comments": "Ok",
    }
    headers = {"Content-Type": "application/json"}
    test_client.post("/create_criterion", data=json.dumps(payload), headers=headers)

    payload["grade"] = 5
    resp = test_client.post("/create_criterion", data=json.dumps(payload), headers=headers)
    assert resp.status_code == 200
    assert resp.json["msg"] == "Criterion updated"


def test_create_criterion_invalid_review(test_client, review_setup):
    """Non-existent reviewID returns 404."""
    resp = test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": 99999,
                "criterionRowID": review_setup["criterion_desc_id"],
                "grade": 3,
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 404
    assert "Review not found" in resp.json["msg"]


def test_create_criterion_invalid_criterion_row(test_client, review_setup):
    """Non-existent criterionRowID returns 404 (the old root cause of the bug)."""
    data = review_setup

    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]

    # Send index 0 (old buggy behaviour) – should be 404
    resp = test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": review_id,
                "criterionRowID": 0,   # index 0 is not a valid DB id
                "grade": 3,
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 404
    assert "Criteria description not found" in resp.json["msg"]


def test_create_criterion_missing_fields(test_client, review_setup):
    """Missing required fields returns 400."""
    resp = test_client.post(
        "/create_criterion",
        data=json.dumps({"reviewID": 1}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /review
# ---------------------------------------------------------------------------


def test_get_review_returns_grades(test_client, review_setup):
    """GET /review returns the grade array for a submitted review."""
    data = review_setup

    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]

    test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": review_id,
                "criterionRowID": data["criterion_desc_id"],
                "grade": 4,
                "comments": "",
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    resp = test_client.get(
        f"/review?assignmentID={data['assignment_id']}"
        f"&reviewerID={data['student1_id']}"
        f"&revieweeID={data['student2_id']}"
    )
    assert resp.status_code == 200
    assert resp.json["grades"] == [4]


def test_get_review_not_found(test_client, review_setup):
    """GET /review returns an empty payload when the review doesn't exist."""
    data = review_setup
    resp = test_client.get(
        f"/review?assignmentID={data['assignment_id']}"
        f"&reviewerID={data['student1_id']}"
        f"&revieweeID=99999"
    )
    assert resp.status_code == 200
    assert resp.json == {"id": None, "grades": [], "comments": []}


def test_get_review_missing_params(test_client, review_setup):
    """GET /review without required params returns 400."""
    resp = test_client.get(f"/review?assignmentID={review_setup['assignment_id']}")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /reviews/received
# ---------------------------------------------------------------------------


def test_student_received_reviews_hide_reviewer_name(test_client, review_setup):
    """Students see received reviews with anonymized reviewer names."""
    data = review_setup

    # student1 reviews student2
    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]
    test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": review_id,
                "criterionRowID": data["criterion_desc_id"],
                "grade": 4,
                "comments": "Great job",
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    # Login as reviewee student2 and fetch received reviews.
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "s2@rev.com", "password": "pass"}),
        headers={"Content-Type": "application/json"},
    )

    resp = test_client.get(f"/reviews/received?assignmentID={data['assignment_id']}")
    assert resp.status_code == 200
    assert resp.json["revieweeID"] == data["student2_id"]
    assert len(resp.json["reviews"]) == 1
    assert resp.json["reviews"][0]["reviewerName"] == "Anonymous"
    assert resp.json["reviews"][0]["criteria"][0]["grade"] == 4


def test_teacher_received_reviews_show_reviewer_name(test_client, review_setup):
    """Teacher of class can see reviewer identities for student's received reviews."""
    data = review_setup

    # student1 reviews student2
    review_resp = test_client.post(
        "/create_review",
        data=json.dumps(
            {
                "assignmentID": data["assignment_id"],
                "reviewerID": data["student1_id"],
                "revieweeID": data["student2_id"],
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    review_id = review_resp.json["id"]
    test_client.post(
        "/create_criterion",
        data=json.dumps(
            {
                "reviewID": review_id,
                "criterionRowID": data["criterion_desc_id"],
                "grade": 5,
                "comments": "Excellent",
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    # Login as class teacher/admin and fetch received reviews for student2.
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@rev.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    resp = test_client.get(
        f"/reviews/received?assignmentID={data['assignment_id']}&revieweeID={data['student2_id']}"
    )
    assert resp.status_code == 200
    assert len(resp.json["reviews"]) == 1
    assert resp.json["reviews"][0]["reviewerName"] == "Student One"
    assert resp.json["reviews"][0]["criteria"][0]["question"] == "Teamwork"


def test_teacher_received_reviews_requires_reviewee_id(test_client, review_setup):
    """Teacher/admin must supply revieweeID when requesting received reviews."""
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@rev.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )
    resp = test_client.get(f"/reviews/received?assignmentID={review_setup['assignment_id']}")
    assert resp.status_code == 400
