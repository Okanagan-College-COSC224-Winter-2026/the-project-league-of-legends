import io
import json


def register_and_login(test_client, email="student@example.com", password="123456", name="Student"):
    test_client.post(
        "/auth/register",
        data=json.dumps({"name": name, "password": password, "email": email}),
        headers={"Content-Type": "application/json"},
    )
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": email, "password": password}),
        headers={"Content-Type": "application/json"},
    )


def test_user_can_upload_and_fetch_profile_picture(test_client):
    register_and_login(test_client)

    response = test_client.put(
        "/user/",
        data={
            "username": "student1",
            "profile_picture": (io.BytesIO(b"fake image bytes"), "avatar.png"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    filename = response.json["profile_picture"]
    assert filename.endswith(".png")

    image_response = test_client.get(f"/user/profile-picture/{filename}")
    assert image_response.status_code == 200
    assert image_response.data == b"fake image bytes"


def test_assignment_download_preserves_filename_and_content_type(
    test_client,
    make_admin,
):
    make_admin(email="teacher@example.com", password="teacher", name="Teacher")
    test_client.post(
        "/auth/login",
        data=json.dumps({"email": "teacher@example.com", "password": "teacher"}),
        headers={"Content-Type": "application/json"},
    )

    class_response = test_client.post(
        "/class/create_class",
        data=json.dumps({"name": "History 101"}),
        headers={"Content-Type": "application/json"},
    )
    class_id = class_response.json["class"]["id"]

    create_response = test_client.post(
        "/assignment/create_assignment",
        data={
            "courseID": str(class_id),
            "name": "Essay 1",
            "file": (io.BytesIO(b"%PDF-1.4 fake"), "instructions.pdf"),
        },
        content_type="multipart/form-data",
    )

    assert create_response.status_code == 201
    assignment_id = create_response.json["assignment"]["id"]

    download_response = test_client.get(
        f"/assignment/download_assignment_file/{assignment_id}"
    )

    assert download_response.status_code == 200
    assert "attachment; filename=instructions.pdf" in download_response.headers[
        "Content-Disposition"
    ]
    assert download_response.mimetype == "application/pdf"
    assert download_response.data == b"%PDF-1.4 fake"
