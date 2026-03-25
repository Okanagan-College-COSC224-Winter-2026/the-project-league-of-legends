import json

from werkzeug.security import generate_password_hash

from api.models import (
    Assignment,
    Course,
    CourseGroup,
    Group_Members,
    Review,
    Submission,
    User,
    User_Course,
)


def _login(test_client, email: str, password: str):
    return test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_assignment_progress_dashboard_teacher_view(test_client, dbsession):
    teacher = User(
        name="Teacher",
        email="teacher.progress@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="teacher",
    )
    student_a = User(
        name="Alice",
        email="alice.progress@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )
    student_b = User(
        name="Bob",
        email="bob.progress@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )
    dbsession.add_all([teacher, student_a, student_b])
    dbsession.commit()

    course = Course(teacherID=teacher.id, name="Progress 101")
    dbsession.add(course)
    dbsession.commit()

    dbsession.add_all(
        [
            User_Course(userID=student_a.id, courseID=course.id),
            User_Course(userID=student_b.id, courseID=course.id),
        ]
    )
    dbsession.commit()

    assignment = Assignment(courseID=course.id, name="Assignment A", rubric_text=None)
    dbsession.add(assignment)
    dbsession.commit()

    dbsession.add(Submission(path="/tmp/alice.txt", studentID=student_a.id, assignmentID=assignment.id))

    group = CourseGroup(name="Group 1", assignmentID=assignment.id)
    dbsession.add(group)
    dbsession.commit()

    dbsession.add_all(
        [
            Group_Members(userID=student_a.id, groupID=group.id, assignmentID=assignment.id),
            Group_Members(userID=student_b.id, groupID=group.id, assignmentID=assignment.id),
            Review(
                assignmentID=assignment.id,
                reviewerID=student_a.id,
                revieweeID=student_b.id,
            ),
        ]
    )
    dbsession.commit()

    login_resp = _login(test_client, teacher.email, "pw123456")
    assert login_resp.status_code == 200

    resp = test_client.get("/dashboard/assignment-progress")
    assert resp.status_code == 200

    data = resp.get_json()
    assert "courses" in data
    assert len(data["courses"]) == 1

    course_data = data["courses"][0]
    assert course_data["course_name"] == "Progress 101"
    assert len(course_data["assignments"]) == 1

    assignment_data = course_data["assignments"][0]
    assert assignment_data["assignment_name"] == "Assignment A"

    student_status_map = {
        row["student_name"]: row["submission_status"]
        for row in assignment_data["student_progress"]
    }
    assert student_status_map["Alice"] == "submitted"
    assert student_status_map["Bob"] == "not_submitted"

    group_progress = assignment_data["group_progress"]
    assert len(group_progress) == 1
    assert group_progress[0]["group_name"] == "Group 1"
    assert group_progress[0]["evaluation_status"] == "partially_evaluated"
    assert group_progress[0]["reviewed_member_count"] == 1
    assert group_progress[0]["total_members"] == 2


def test_assignment_progress_dashboard_forbidden_for_student(test_client, dbsession):
    student = User(
        name="Student",
        email="student.progress@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="student",
    )
    dbsession.add(student)
    dbsession.commit()

    login_resp = _login(test_client, student.email, "pw123456")
    assert login_resp.status_code == 200

    resp = test_client.get("/dashboard/assignment-progress")
    assert resp.status_code == 403


def test_assignment_progress_excludes_courses_without_assignments(test_client, dbsession):
    teacher = User(
        name="Teacher",
        email="teacher.noassignment@example.com",
        hash_pass=generate_password_hash("pw123456"),
        role="teacher",
    )
    dbsession.add(teacher)
    dbsession.commit()

    empty_course = Course(teacherID=teacher.id, name="Empty Course")
    active_course = Course(teacherID=teacher.id, name="Active Course")
    dbsession.add_all([empty_course, active_course])
    dbsession.commit()

    assignment = Assignment(courseID=active_course.id, name="Assignment X", rubric_text=None)
    dbsession.add(assignment)
    dbsession.commit()

    login_resp = _login(test_client, teacher.email, "pw123456")
    assert login_resp.status_code == 200

    resp = test_client.get("/dashboard/assignment-progress")
    assert resp.status_code == 200

    data = resp.get_json()
    course_names = [course["course_name"] for course in data["courses"]]

    assert "Active Course" in course_names
    assert "Empty Course" not in course_names
