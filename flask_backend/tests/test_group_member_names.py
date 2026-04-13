import json

from api.models import Assignment, Course, CourseGroup, Group_Members, User
from api.models.db import db


def test_list_student_group_includes_names_even_if_membership_is_assignment_based(test_client):
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "Teacher", "password": "123456", "email": "teacher@example.com"}),
        headers={"Content-Type": "application/json"},
    )
    teacher = User.get_by_email("teacher@example.com")
    teacher.role = "teacher"
    teacher.update()

    student_one = User(name="Alice", email="alice@example.com", hash_pass="hash", role="student")
    student_two = User(name="Bob", email="bob@example.com", hash_pass="hash", role="student")
    db.session.add(student_one)
    db.session.add(student_two)
    db.session.commit()

    course = Course(teacherID=teacher.id, name="Biology 101")
    db.session.add(course)
    db.session.commit()

    assignment = Assignment(courseID=course.id, name="Lab Report", rubric_text=None)
    Assignment.create(assignment)

    group = CourseGroup(name="Team A", assignmentID=assignment.id)
    CourseGroup.create_group(group)

    Group_Members.create_group_member(student_one.id, group.id, assignment.id)
    Group_Members.create_group_member(student_two.id, group.id, assignment.id)

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )

    response = test_client.get(f"/groups/list_stu_groups/{assignment.id}/{student_one.id}")

    assert response.status_code == 200
    assert {member["name"] for member in response.json} == {"Alice", "Bob"}
    assert all("userID" in member for member in response.json)
