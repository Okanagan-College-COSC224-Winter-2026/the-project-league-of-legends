"""
Tests for rubric and criteria endpoints
"""

import json
from werkzeug.security import generate_password_hash


def test_teacher_can_create_rubric_and_criteria(test_client, make_admin):
    # Create teacher and log in
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    # Create a class
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Biology 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    # Create an assignment
    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": class_id, "name": "Lab 1", "rubric": "Lab rubric"}),
        headers={"Content-Type": "application/json"},
    )
    assert assignment_response.status_code == 201
    assignment_id = assignment_response.json["assignment"]["id"]

    # Create rubric
    rubric_resp = test_client.post(
        "/create_rubric",
        data=json.dumps({"assignmentID": assignment_id, "canComment": True}),
        headers={"Content-Type": "application/json"},
    )
    assert rubric_resp.status_code == 201
    rubric_id = rubric_resp.json["id"]

    # Create criteria
    criteria_resp = test_client.post(
        "/create_criteria",
        data=json.dumps({"rubricID": rubric_id, "question": "Clarity", "scoreMax": 5, "hasScore": True}),
        headers={"Content-Type": "application/json"},
    )
    assert criteria_resp.status_code == 201
    criteria_id = criteria_resp.json["id"]

    # Fetch criteria list by rubric id
    get_criteria = test_client.get(f"/criteria?rubricID={rubric_id}")
    assert get_criteria.status_code == 200
    criteria_list = get_criteria.json
    assert isinstance(criteria_list, list)
    assert any(c["question"] == "Clarity" and c["scoreMax"] == 5 for c in criteria_list)

    # Fetch rubric by assignment id
    get_rubric_by_assignment = test_client.get(f"/rubric?assignmentID={assignment_id}")
    assert get_rubric_by_assignment.status_code == 200
    assert get_rubric_by_assignment.json["id"] == rubric_id

    # Fetch criteria by assignment id
    get_criteria_by_assignment = test_client.get(f"/criteria?assignmentID={assignment_id}")
    assert get_criteria_by_assignment.status_code == 200
    criteria_list2 = get_criteria_by_assignment.json
    assert isinstance(criteria_list2, list)
    assert any(c["question"] == "Clarity" and c["scoreMax"] == 5 for c in criteria_list2)


def test_student_cannot_create_rubric(test_client, make_admin):
    # Create teacher to make class and assignment
    make_admin(email="teacher2@example.com", password="teacher", name="teacheruser2")

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher2@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Chemistry 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps({"courseID": class_id, "name": "Lab 2", "rubric": "Chem rubric"}),
        headers={"Content-Type": "application/json"},
    )
    assignment_id = assignment_response.json["assignment"]["id"]

    # Create a student user directly in DB and log in as student
    from api.models import User
    student = User(name="Student", email="student@example.com", hash_pass=generate_password_hash("pass"), role="student")
    student = User.create_user(student)

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "student@example.com", "password": "pass"}),
        headers={"Content-Type": "application/json"},
    )

    # Student attempts to create a rubric for assignment (should be forbidden)
    resp = test_client.post(
        "/create_rubric",
        data=json.dumps({"assignmentID": assignment_id, "canComment": False}),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_rubric_endpoints_require_authentication(test_client):
    # Without logging in, attempts should be unauthorized (401)
    resp = test_client.get("/rubric?rubricID=1")
    assert resp.status_code == 401

    resp2 = test_client.get("/criteria?rubricID=1")
    assert resp2.status_code == 401
