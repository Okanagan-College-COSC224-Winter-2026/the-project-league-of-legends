"""
Tests for US-17 — Student Course Search (GET /class/search_course)
"""

import json

import pytest
from werkzeug.security import generate_password_hash

from api.models import Course, User, User_Course
from api.models.db import db as _db


# ── helpers ────────────────────────────────────────────────

def _login(client, email, password):
    return client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def _search(client, q=""):
    url = f"/class/search_course?q={q}" if q else "/class/search_course"
    return client.get(url, headers={"Content-Type": "application/json"})


# ── fixtures ───────────────────────────────────────────────

@pytest.fixture
def seed_courses(db):
    """Create two teachers, five courses, and one enrolled student."""
    teacher1 = User(
        name="Teacher One",
        email="teacher1@example.com",
        hash_pass=generate_password_hash("pass123"),
        role="teacher",
    )
    teacher2 = User(
        name="Teacher Two",
        email="teacher2@example.com",
        hash_pass=generate_password_hash("pass123"),
        role="teacher",
    )
    student = User(
        name="Student A",
        email="student@example.com",
        hash_pass=generate_password_hash("pass123"),
        role="student",
    )
    admin = User(
        name="Admin",
        email="admin@example.com",
        hash_pass=generate_password_hash("pass123"),
        role="admin",
    )
    _db.session.add_all([teacher1, teacher2, student, admin])
    _db.session.commit()

    # Courses — teacher1 owns 3, teacher2 owns 2
    c1 = Course(teacherID=teacher1.id, name="COSC 224 Projects in CS")
    c2 = Course(teacherID=teacher1.id, name="MATH 101 Introduction to Calculus")
    c3 = Course(teacherID=teacher1.id, name="COSC 111 Programming I")
    c4 = Course(teacherID=teacher2.id, name="ENGL 100 Academic Writing")
    c5 = Course(teacherID=teacher2.id, name="COSC 222 Data Structures")
    _db.session.add_all([c1, c2, c3, c4, c5])
    _db.session.commit()

    # Enroll student in c1, c2, c5 only
    for cid in [c1.id, c2.id, c5.id]:
        _db.session.add(User_Course(userID=student.id, courseID=cid))
    _db.session.commit()

    return {
        "teacher1": teacher1,
        "teacher2": teacher2,
        "student": student,
        "admin": admin,
        "courses": [c1, c2, c3, c4, c5],
    }


# ── AUTH ───────────────────────────────────────────────────

class TestSearchAuth:
    """Unauthenticated users must not access /class/search_course."""

    def test_search_requires_login(self, test_client):
        resp = _search(test_client, "COSC")
        assert resp.status_code == 401


# ── ADMIN SEARCH ───────────────────────────────────────────

class TestAdminSearch:
    """Admin can search all courses."""

    def test_empty_query_returns_all(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 5

    def test_single_token(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client, "COSC")
        data = resp.get_json()
        assert resp.status_code == 200
        # c1, c3, c5 contain "COSC"
        assert len(data) == 3
        names = {c["name"] for c in data}
        assert "COSC 224 Projects in CS" in names
        assert "COSC 111 Programming I" in names
        assert "COSC 222 Data Structures" in names

    def test_multi_token_order_independent(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        # "Projects COSC" should match "COSC 224 Projects in CS"
        resp = _search(test_client, "Projects COSC")
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["name"] == "COSC 224 Projects in CS"

    def test_case_insensitive(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client, "cosc")
        data = resp.get_json()
        assert len(data) == 3

    def test_no_results(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client, "PHYS")
        data = resp.get_json()
        assert resp.status_code == 200
        assert data == []

    def test_extra_char_no_match(self, test_client, seed_courses):
        """Token with extra unrelated character must NOT match."""
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client, "COSCx")
        assert resp.get_json() == []

    def test_response_includes_teacher_name(self, test_client, seed_courses):
        _login(test_client, "admin@example.com", "pass123")
        resp = _search(test_client, "COSC 224")
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["teacher_name"] == "Teacher One"
        assert "teacherID" in data[0]


# ── TEACHER SEARCH ─────────────────────────────────────────

class TestTeacherSearch:
    """Teacher can search only own courses."""

    def test_teacher_sees_own_courses_only(self, test_client, seed_courses):
        _login(test_client, "teacher1@example.com", "pass123")
        resp = _search(test_client)
        data = resp.get_json()
        assert resp.status_code == 200
        # teacher1 owns c1, c2, c3
        assert len(data) == 3

    def test_teacher_cannot_see_other_teacher_courses(self, test_client, seed_courses):
        _login(test_client, "teacher1@example.com", "pass123")
        resp = _search(test_client, "ENGL")
        data = resp.get_json()
        # ENGL 100 belongs to teacher2
        assert data == []

    def test_teacher_search_by_token(self, test_client, seed_courses):
        _login(test_client, "teacher1@example.com", "pass123")
        resp = _search(test_client, "COSC")
        data = resp.get_json()
        # teacher1 owns c1 (COSC 224) and c3 (COSC 111)
        assert len(data) == 2


# ── STUDENT SEARCH ─────────────────────────────────────────

class TestStudentSearch:
    """Student can search only enrolled courses."""

    def test_student_empty_query_returns_enrolled(self, test_client, seed_courses):
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client)
        data = resp.get_json()
        assert resp.status_code == 200
        # enrolled in c1, c2, c5
        assert len(data) == 3

    def test_student_cannot_see_unenrolled(self, test_client, seed_courses):
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client, "ENGL")
        # student is NOT enrolled in ENGL 100
        assert resp.get_json() == []

    def test_student_search_multi_token(self, test_client, seed_courses):
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client, "Data COSC")
        data = resp.get_json()
        # "COSC 222 Data Structures" — enrolled
        assert len(data) == 1
        assert data[0]["name"] == "COSC 222 Data Structures"

    def test_student_unenrolled_course_not_found(self, test_client, seed_courses):
        """COSC 111 exists but student is not enrolled — must not appear."""
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client, "111")
        assert resp.get_json() == []

    def test_student_search_partial_word_no_match(self, test_client, seed_courses):
        """'Intro' is not in 'Introduction' as a substring… actually it is.
        But 'Introx' should NOT match."""
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client, "Introx")
        assert resp.get_json() == []

    def test_student_search_partial_substring_match(self, test_client, seed_courses):
        """'Intro' IS a substring of 'Introduction' — should match."""
        _login(test_client, "student@example.com", "pass123")
        resp = _search(test_client, "Intro")
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["name"] == "MATH 101 Introduction to Calculus"
