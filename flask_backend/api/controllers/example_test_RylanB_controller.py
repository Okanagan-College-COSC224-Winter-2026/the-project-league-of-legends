"""
Fake API endpoints for testing/development
"""

from flask import Blueprint, jsonify, request

practice = Blueprint("practice", __name__, url_prefix="/example")

@practice.route("/test", methods=("POST", "GET"))
def get_practice():
    if request.method == "GET":
        return (
            jsonify(
                {
                 "course":"cosc 224"
                }
            ), 200,
        )