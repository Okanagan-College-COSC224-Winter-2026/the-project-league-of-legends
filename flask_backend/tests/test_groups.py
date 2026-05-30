"""Tests for group management endpoints (US27)"""
import io
import json
import pytest
import datetime

from api.models import User


@pytest.fixture
def course_with_assignment(test_client, make_admin):
    """Create a course with an assignment for testing"""
    # Create a teacher user and login
    make_admin(email="teacher@example.com", password="password", name="Teacher")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "password"}),
        headers={"Content-Type": "application/json"},
    )

    # Create class
    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "Test Group Course"}),
        headers={"Content-Type": "application/json"},
    )
    assert class_response.status_code == 201
    course_id = class_response.json["class"]["id"]

    # Create assignment with future due date
    future_due = (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    ).replace(microsecond=0)
    due_str = future_due.replace(tzinfo=None).isoformat()

    assignment_response = test_client.post(
        "/assignment/create_assignment",
        data=json.dumps(
            {
                "courseID": course_id,
                "name": "Group Assignment",
                "rubric": "Test rubric",
                "due_date": due_str,
            }
        ),
        headers={"Content-Type": "application/json"},
    )
    assert assignment_response.status_code == 201
    assignment_id = assignment_response.json["assignment"]["id"]

    return {
        "course_id": course_id,
        "assignment_id": assignment_id,
        "test_client": test_client,
    }


class TestGroupCreation:
    """Test group creation endpoint"""

    def test_create_group_success(self, test_client, course_with_assignment):
        """Test successful group creation by teacher"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 201
        assert response.json["msg"] == "Group created successfully"
        assert response.json["group"]["name"] == "Group A"

    def test_create_group_missing_assignment_id(self, test_client, make_admin):
        """Test group creation fails without assignment ID"""
        make_admin(email="teacher@example.com", password="password", name="Teacher")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "teacher@example.com", "password": "password"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.post(
            "/groups/create",
            data=json.dumps({"name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 400
        assert "Assignment ID is required" in response.json["msg"]

    def test_create_group_missing_name(self, test_client, course_with_assignment):
        """Test group creation fails without group name"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 400
        assert "Group name is required" in response.json["msg"]

    def test_create_group_invalid_assignment(self, test_client, make_admin):
        """Test group creation fails with non-existent assignment"""
        make_admin(email="teacher@example.com", password="password", name="Teacher")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "teacher@example.com", "password": "password"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": 9999, "name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 404
        assert "Assignment not found" in response.json["msg"]

    def test_create_group_unauthorized_teacher(
        self, test_client, course_with_assignment, make_admin
    ):
        """Test non-course teacher cannot create group"""
        # Create a different teacher
        make_admin(
            email="other_teacher@example.com", password="password", name="Other Teacher"
        )

        # Logout and login as other teacher
        test_client.get("/auth/logout")
        test_client.post(
            "/auth/login",
            data=json.dumps(
                {"email": "other_teacher@example.com", "password": "password"}
            ),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.post(
            "/groups/create",
            data=json.dumps(
                {"assignmentID": course_with_assignment["assignment_id"], "name": "Group A"}
            ),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 403
        assert "not the teacher" in response.json["msg"]

    def test_group_changes_blocked_after_submission(
        self, test_client, course_with_assignment, enroll_user_in_course
    ):
        """Teachers cannot modify groups after any submission exists for the assignment."""
        assignment_id = course_with_assignment["assignment_id"]
        course_id = course_with_assignment["course_id"]

        test_client.post(
            "/auth/register",
            data=json.dumps(
                {
                    "name": "Student User",
                    "email": "student-lock@example.com",
                    "password": "password123",
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        student = User.get_by_email("student-lock@example.com")
        enroll_user_in_course(student.id, course_id)

        test_client.post("/auth/logout")
        test_client.post(
            "/auth/login",
            data=json.dumps(
                {
                    "email": "student-lock@example.com",
                    "password": "password123",
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        submit_response = test_client.post(
            f"/assignment/submit/{assignment_id}",
            data={"file": (io.BytesIO(b"hello"), "submission.txt")},
            content_type="multipart/form-data",
        )
        assert submit_response.status_code in (200, 201)

        test_client.post("/auth/logout")
        test_client.post(
            "/auth/login",
            data=json.dumps(
                {
                    "email": "teacher@example.com",
                    "password": "password",
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Locked Group"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 400
        assert "submissions or reviews" in response.json["msg"]


class TestGetGroups:
    """Test retrieving groups for an assignment"""

    def test_get_groups_success(self, test_client, course_with_assignment):
        """Test retrieving groups for an assignment"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create multiple groups
        for i in range(2):
            test_client.post(
                "/groups/create",
                data=json.dumps({"assignmentID": assignment_id, "name": f"Group {i + 1}"}),
                headers={"Content-Type": "application/json"},
            )

        response = test_client.get(f"/groups/{assignment_id}")
        assert response.status_code == 200
        groups = response.json
        assert len(groups) == 2

    def test_get_groups_invalid_assignment(self, test_client, make_admin):
        """Test retrieving groups for non-existent assignment"""
        make_admin(email="teacher@example.com", password="password", name="Teacher")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "teacher@example.com", "password": "password"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.get("/groups/9999")
        assert response.status_code == 404
        assert "Assignment not found" in response.json["msg"]

    def test_enrolled_student_can_view_groups(
        self, test_client, course_with_assignment, enroll_user_in_course
    ):
        """Test enrolled students can retrieve groups for an assignment."""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]
        course_id = course_with_assignment["course_id"]

        create_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        assert create_response.status_code == 201

        test_client.post(
            "/auth/register",
            data=json.dumps(
                {
                    "name": "Student User",
                    "email": "student@example.com",
                    "password": "password123",
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        student = User.get_by_email("student@example.com")
        enroll_user_in_course(student.id, course_id)

        test_client.post("/auth/logout")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "student@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.get(f"/groups/{assignment_id}")
        assert response.status_code == 200
        assert len(response.json) == 1

    def test_enrolled_student_can_view_their_group_membership(
        self, test_client, course_with_assignment, enroll_user_in_course
    ):
        """Test list_stu_groups returns membership-shaped rows for enrolled student group view."""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]
        course_id = course_with_assignment["course_id"]

        group_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = group_response.json["group"]["id"]

        test_client.post(
            "/auth/register",
            data=json.dumps(
                {
                    "name": "Student User",
                    "email": "student2@example.com",
                    "password": "password123",
                }
            ),
            headers={"Content-Type": "application/json"},
        )
        student = User.get_by_email("student2@example.com")
        enroll_user_in_course(student.id, course_id)

        test_client.post(
            "/groups/save_groups",
            data=json.dumps(
                {
                    "groupID": group_id,
                    "userID": student.id,
                    "assignmentID": assignment_id,
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        test_client.post("/auth/logout")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "student2@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.get(f"/groups/list_stu_groups/{assignment_id}/{student.id}")
        assert response.status_code == 200
        assert len(response.json) == 1
        assert response.json[0]["userID"] == student.id
        assert response.json[0]["groupID"] == group_id
        assert response.json[0]["assignmentID"] == assignment_id


class TestEditGroup:
    """Test editing group information"""

    def test_edit_group_name_success(self, test_client, course_with_assignment):
        """Test successfully editing group name"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create a group
        create_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Original Name"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = create_response.json["group"]["id"]

        # Edit the group
        response = test_client.patch(
            f"/groups/{group_id}",
            data=json.dumps({"name": "Updated Name"}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 200
        assert response.json["group"]["name"] == "Updated Name"

    def test_edit_group_missing_name(self, test_client, course_with_assignment):
        """Test editing group fails without new name"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        create_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Group A"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = create_response.json["group"]["id"]

        response = test_client.patch(
            f"/groups/{group_id}",
            data=json.dumps({}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 400


class TestDeleteGroup:
    """Test deleting groups"""

    def test_delete_group_success(self, test_client, course_with_assignment):
        """Test successfully deleting a group"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        create_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Group to Delete"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = create_response.json["group"]["id"]

        response = test_client.delete(f"/groups/{group_id}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json["msg"]

    def test_delete_group_invalid_id(self, test_client, make_admin):
        """Test deleting non-existent group"""
        make_admin(email="teacher@example.com", password="password", name="Teacher")
        test_client.post(
            "/auth/login",
            data=json.dumps({"email": "teacher@example.com", "password": "password"}),
            headers={"Content-Type": "application/json"},
        )

        response = test_client.delete("/groups/9999")
        assert response.status_code == 404


class TestGroupMembers:
    """Test managing group members"""

    def test_add_member_success(self, test_client, course_with_assignment):
        """Test successfully adding a student to a group"""
        test_client = course_with_assignment["test_client"]
        course_id = course_with_assignment["course_id"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create group
        group_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Test Group"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = group_response.json["group"]["id"]

        # Enroll a student
        test_client.post(
            "/class/enroll_students",
            data=json.dumps(
                {
                    "class_id": course_id,
                    "students": "id,name,email\n1,Test Student,student@example.com",
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        # Get student ID
        from api.models import User

        student = User.get_by_email("student@example.com")

        response = test_client.post(
            f"/groups/{group_id}/add_member",
            data=json.dumps({"userID": student.id}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 201
        assert "added to group successfully" in response.json["msg"]

    def test_add_member_missing_user_id(self, test_client, course_with_assignment):
        """Test adding member fails without user ID"""
        test_client = course_with_assignment["test_client"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create group
        group_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Test Group"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = group_response.json["group"]["id"]

        response = test_client.post(
            f"/groups/{group_id}/add_member",
            data=json.dumps({}),
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 400

    def test_remove_member_success(self, test_client, course_with_assignment):
        """Test successfully removing a student from a group"""
        test_client = course_with_assignment["test_client"]
        course_id = course_with_assignment["course_id"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create group
        group_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Test Group"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = group_response.json["group"]["id"]

        # Enroll a student
        test_client.post(
            "/class/enroll_students",
            data=json.dumps(
                {
                    "class_id": course_id,
                    "students": "id,name,email\n1,Test Student,student@example.com",
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        # Get student ID
        from api.models import User

        student = User.get_by_email("student@example.com")

        # Add member first
        test_client.post(
            f"/groups/{group_id}/add_member",
            data=json.dumps({"userID": student.id}),
            headers={"Content-Type": "application/json"},
        )

        # Remove member
        response = test_client.delete(f"/groups/{group_id}/remove_member/{student.id}")
        assert response.status_code == 200
        assert "removed from group successfully" in response.json["msg"]

    def test_get_group_members(self, test_client, course_with_assignment):
        """Test retrieving members of a group"""
        test_client = course_with_assignment["test_client"]
        course_id = course_with_assignment["course_id"]
        assignment_id = course_with_assignment["assignment_id"]

        # Create group
        group_response = test_client.post(
            "/groups/create",
            data=json.dumps({"assignmentID": assignment_id, "name": "Test Group"}),
            headers={"Content-Type": "application/json"},
        )
        group_id = group_response.json["group"]["id"]

        # Enroll a student
        test_client.post(
            "/class/enroll_students",
            data=json.dumps(
                {
                    "class_id": course_id,
                    "students": "id,name,email\n1,Test Student,student@example.com",
                }
            ),
            headers={"Content-Type": "application/json"},
        )

        # Get student ID
        from api.models import User

        student = User.get_by_email("student@example.com")

        # Add member
        test_client.post(
            f"/groups/{group_id}/add_member",
            data=json.dumps({"userID": student.id}),
            headers={"Content-Type": "application/json"},
        )

        # Get members
        response = test_client.get(f"/groups/{group_id}/members")
        assert response.status_code == 200
        members = response.json
        assert len(members) == 1
        assert members[0]["id"] == student.id
