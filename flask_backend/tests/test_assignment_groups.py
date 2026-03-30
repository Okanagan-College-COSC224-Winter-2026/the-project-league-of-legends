import json

from werkzeug.security import generate_password_hash

from api.models import Assignment, Course, CourseGroup, User, User_Course


def _login(test_client, email: str, password: str):
    return test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_teacher_can_assign_students_to_assignment_groups(test_client, dbsession):
    teacher = User(
        name="Teacher",
        email="teacher.groups@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="teacher",
    )
    student_a = User(
        name="Alice",
        email="alice.groups@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )
    student_b = User(
        name="Bob",
        email="bob.groups@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )

    dbsession.add_all([teacher, student_a, student_b])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Course Groups")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add_all(
        [
            User_Course(userID=student_a.id, courseID=course.id),
            User_Course(userID=student_b.id, courseID=course.id),
        ]
    )
    dbsession.commit()

    assignment = Assignment(courseID=course.id, name="Assignment G", rubric_text=None)
    dbsession.add(assignment)
    dbsession.commit()

    login_resp = _login(test_client, teacher.email, "pw123456")
    assert login_resp.status_code == 200

    next_group_resp = test_client.get(f"/assignment/next_groupid?assignmentID={assignment.id}")
    assert next_group_resp.status_code == 200
    assert isinstance(next_group_resp.get_json().get("id"), int)

    create_group_resp = test_client.post(
        "/assignment/create_group",
        data=json.dumps({"assignmentID": assignment.id, "name": "Group 1"}),
        headers={"Content-Type": "application/json"},
    )
    assert create_group_resp.status_code == 201
    created_group_id = create_group_resp.get_json()["id"]

    list_groups_resp = test_client.get(f"/assignment/list_all_groups/{assignment.id}")
    assert list_groups_resp.status_code == 200
    groups_payload = list_groups_resp.get_json()
    assert len(groups_payload) == 1
    assert groups_payload[0]["id"] == created_group_id

    assign_resp = test_client.post(
        "/assignment/save_groups",
        data=json.dumps(
            {
                "groupID": created_group_id,
                "userID": student_a.id,
                "assignmentID": assignment.id,
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert assign_resp.status_code == 200

    group_members_resp = test_client.get(
        f"/assignment/list_group_members/{assignment.id}/{created_group_id}"
    )
    assert group_members_resp.status_code == 200
    group_members_payload = group_members_resp.get_json()
    assert len(group_members_payload) == 1
    assert group_members_payload[0]["userID"] == student_a.id

    unassigned_resp = test_client.get(f"/assignment/list_ua_groups/{assignment.id}")
    assert unassigned_resp.status_code == 200
    unassigned_user_ids = {entry["userID"] for entry in unassigned_resp.get_json()}
    assert student_b.id in unassigned_user_ids
    assert student_a.id not in unassigned_user_ids

    assignment_members_resp = test_client.get(f"/assignment/{assignment.id}/members")
    assert assignment_members_resp.status_code == 200
    assignment_member_ids = {entry["id"] for entry in assignment_members_resp.get_json()}
    assert student_a.id in assignment_member_ids
    assert student_b.id in assignment_member_ids

    student_group_resp = test_client.get(
        f"/assignment/list_stu_groups/{assignment.id}/{student_a.id}"
    )
    assert student_group_resp.status_code == 200
    student_group_payload = student_group_resp.get_json()
    assert len(student_group_payload) == 1
    assert student_group_payload[0]["groupID"] == created_group_id


def test_student_cannot_modify_assignment_groups(test_client, dbsession):
    teacher = User(
        name="Teacher",
        email="teacher.blocked@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="teacher",
    )
    student = User(
        name="Student",
        email="student.blocked@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )
    dbsession.add_all([teacher, student])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Blocked Course")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add(User_Course(userID=student.id, courseID=course.id))
    dbsession.commit()

    assignment = Assignment(courseID=course.id, name="Blocked Assignment", rubric_text=None)
    dbsession.add(assignment)
    dbsession.commit()

    group = CourseGroup(name="Group X", assignmentID=assignment.id)
    dbsession.add(group)
    dbsession.commit()

    login_resp = _login(test_client, student.email, "pw123456")
    assert login_resp.status_code == 200

    assign_resp = test_client.post(
        "/assignment/save_groups",
        data=json.dumps(
            {
                "groupID": group.id,
                "userID": student.id,
                "assignmentID": assignment.id,
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert assign_resp.status_code == 403