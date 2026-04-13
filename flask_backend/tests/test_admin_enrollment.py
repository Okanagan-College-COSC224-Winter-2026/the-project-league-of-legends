import json

from api.models import Course, User


def register_and_login_admin(test_client):
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": "Admin", "password": "123456", "email": "admin@example.com"}),
        headers={"Content-Type": "application/json"},
    )

    admin = User.get_by_email("admin@example.com")
    admin.role = "admin"
    admin.update()

    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "admin@example.com", "password": "123456"}),
        headers={"Content-Type": "application/json"},
    )


def test_admin_can_list_students_and_classes_with_enrollments(test_client):
    register_and_login_admin(test_client)

    from api.models.db import db

    teacher = User(name="Teacher", email="teacher@example.com", hash_pass="hash", role="teacher")
    student = User(name="Student", email="student@example.com", hash_pass="hash", role="student")
    db.session.add(teacher)
    db.session.add(student)
    db.session.commit()

    course = Course(teacherID=teacher.id, name="Physics 101")
    db.session.add(course)
    db.session.commit()

    enroll_response = test_client.post(
        "/admin/enroll-student",
        data=json.dumps({"student_id": student.id, "class_id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert enroll_response.status_code == 200

    students_response = test_client.get("/admin/students")
    classes_response = test_client.get("/admin/classes-with-students")

    assert students_response.status_code == 200
    assert classes_response.status_code == 200

    student_payload = next(
        entry for entry in students_response.json if entry["email"] == "student@example.com"
    )
    class_payload = next(
        entry for entry in classes_response.json if entry["name"] == "Physics 101"
    )

    assert student_payload["enrollment_count"] == 1
    assert student_payload["enrolled_courses"][0]["name"] == "Physics 101"
    assert class_payload["student_count"] == 1
    assert class_payload["enrolled_students"][0]["email"] == "student@example.com"


def test_admin_can_unenroll_student(test_client):
    register_and_login_admin(test_client)

    from api.models import User_Course
    from api.models.db import db

    teacher = User(name="Teacher", email="teacher2@example.com", hash_pass="hash", role="teacher")
    student = User(name="Student", email="student2@example.com", hash_pass="hash", role="student")
    db.session.add(teacher)
    db.session.add(student)
    db.session.commit()

    course = Course(teacherID=teacher.id, name="History 201")
    db.session.add(course)
    db.session.commit()

    User_Course.add(student.id, course.id)

    response = test_client.post(
        "/admin/unenroll-student",
        data=json.dumps({"student_id": student.id, "class_id": course.id}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert User_Course.get(student.id, course.id) is None


def test_student_created_from_manage_users_appears_in_student_enrollment(test_client):
    register_and_login_admin(test_client)

    create_response = test_client.post(
        "/admin/users/create",
        data=json.dumps(
            {
                "name": "Enrollment Student",
                "email": "enrollment.student@example.com",
                "password": "studentpass123",
                "role": "student",
            }
        ),
        headers={"Content-Type": "application/json"},
    )

    assert create_response.status_code == 201

    students_response = test_client.get("/admin/students")

    assert students_response.status_code == 200
    created_student = next(
        (
            entry
            for entry in students_response.json
            if entry["email"] == "enrollment.student@example.com"
        ),
        None,
    )

    assert created_student is not None
    assert created_student["name"] == "Enrollment Student"
    assert created_student["enrollment_count"] == 0
