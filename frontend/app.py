# Save this file as app.py in your project's root directory
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/practice/test', methods=['GET'])
def test_endpoint():
    # Returns a JSON object with course as the key and cosc 224 as the value
    return jsonify({"course": "cosc 224"}), 200

if __name__ == '__main__':
    # Run the app on localhost, port 5000 (default)
    app.run(debug=True, port=5000)
