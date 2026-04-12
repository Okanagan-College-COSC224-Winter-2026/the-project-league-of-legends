import json


def _login(test_client, email: str, password: str):
    return test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def _register(test_client, name: str, email: str, password: str):
    return test_client.post(
        "/auth/register",
        data=json.dumps({"name": name, "email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def _create_class(test_client, name: str):
    return test_client.post(
        "/class/create_class",
        data=json.dumps({"name": name}),
        headers={"Content-Type": "application/json"},
    )



# US14 – Teacher deletes a class they created


def test_us14_teacher_can_delete_own_class(test_client, make_admin):
    """
    GIVEN a logged-in teacher/admin user
    WHEN they create a class and then delete it
    THEN delete returns 200 and the class no longer appears in browse_classes
    """
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    _login(test_client, "teacher@example.com", "teacher")

    create_resp = _create_class(test_client, "Delete Me 101")
    assert create_resp.status_code == 201
    class_id = create_resp.json["class"]["id"]

    delete_resp = test_client.delete(
        f"/class/delete_class/{class_id}",
        headers={"Content-Type": "application/json"},
    )
    assert delete_resp.status_code == 200
    assert delete_resp.json["msg"] == "Class deleted"

    browse_resp = test_client.get(
        "/class/browse_classes",
        headers={"Content-Type": "application/json"},
    )
    assert browse_resp.status_code == 200
    assert all(c["id"] != class_id for c in browse_resp.json)



# US15 – Teacher sees roster members for a class


def test_us15_teacher_can_view_members_after_csv_enroll(test_client, make_admin):
    """
    given a teacher who owns a class
    when they enroll students via CSV and then GET /class/<id>/members
    then those students appear in the members response
    """
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    _login(test_client, "teacher@example.com", "teacher")

    create_resp = _create_class(test_client, "Members 101")
    assert create_resp.status_code == 201
    class_id = create_resp.json["class"]["id"]

    csv_text = (
        "id,name,email\n"
        "1001,Alice Student,alice@example.com\n"
        "1002,Bob Student,bob@example.com\n"
    )

    enroll_resp = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert enroll_resp.status_code == 200

    members_resp = test_client.get(
        f"/class/{class_id}/members",
        headers={"Content-Type": "application/json"},
    )
    assert members_resp.status_code == 200

    emails = {m.get("email") for m in members_resp.json}
    assert "alice@example.com" in emails
    assert "bob@example.com" in emails


# US18 – Student registration (roster-matched)


def test_us18_student_can_register_without_being_in_any_class(test_client):
    """
    given a student who is not in any roster
    when they register and log in
    then /class/classes returns [] (no classes yet)
    """
    reg_resp = _register(test_client, "Student One", "student1@example.com", "pw123456")
    assert reg_resp.status_code == 201

    login_resp = _login(test_client, "student1@example.com", "pw123456")
    assert login_resp.status_code == 200

    classes_resp = test_client.get(
        "/class/classes",
        headers={"Content-Type": "application/json"},
    )
    assert classes_resp.status_code == 200
    assert classes_resp.json == []


def test_us18_registered_student_added_via_csv_sees_class(test_client, make_admin):
    """
    given a student already registered
    when a teacher adds that email to the roster via CSV
    Then the student sees that class in /class/classes after logging in
    """
    # Student registers first
    reg_resp = _register(test_client, "Student Two", "student2@example.com", "pw123456")
    assert reg_resp.status_code == 201

    # Teacher creates class
    make_admin(email="teacher@example.com", password="teacher", name="teacheruser")
    _login(test_client, "teacher@example.com", "teacher")

    create_resp = _create_class(test_client, "Roster Match 101")
    assert create_resp.status_code == 201
    class_id = create_resp.json["class"]["id"]

    # Teacher enrolls the already-registered student by same email
    csv_text = "id,name,email\n2001,Student Two,student2@example.com\n"
    enroll_resp = test_client.post(
        "/class/enroll_students",
        data=json.dumps({"class_id": class_id, "students": csv_text}),
        headers={"Content-Type": "application/json"},
    )
    assert enroll_resp.status_code == 200

    # Student logs in and should see the class
    login_resp = _login(test_client, "student2@example.com", "pw123456")
    assert login_resp.status_code == 200

    classes_resp = test_client.get(
        "/class/classes",
        headers={"Content-Type": "application/json"},
    )
    assert classes_resp.status_code == 200
    assert any(c["id"] == class_id for c in classes_resp.json)
    assert any(c["name"] == "Roster Match 101" for c in classes_resp.json)


def test_us18_duplicate_registration_prevented(test_client):
    """
    given a student already registered
    when they try to register again with the same email
    then registration is rejected with a 400
    """
    first = _register(test_client, "Student Three", "student3@example.com", "pw123456")
    assert first.status_code == 201

    second = _register(test_client, "Student Three", "student3@example.com", "pw123456")
    assert second.status_code == 400
    assert "already" in second.json["msg"].lower() or "exists" in second.json["msg"].lower()