def test_practice_endpoint(test_client):
    response = test_client.get("/api/v1/practice/test")
    assert response.status_code == 200

    json_data = response.get_json()
    print(json_data)  

    assert json_data is not None
    assert "course" in json_data
    assert json_data["course"] == "cosc 224"
