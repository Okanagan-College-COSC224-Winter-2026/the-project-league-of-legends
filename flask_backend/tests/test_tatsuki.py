def test_practice_test(test_client):
    response = test_client.get("/api/v1/practice/test")

    assert response.status_code == 200
    assert response is not None
    assert "course" in response.json
    assert response.json["course"] == "cosc 224"