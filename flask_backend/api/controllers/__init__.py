# Controllers package
from flask import Flask

def create_app():
    app = Flask(__name__)

    from .controllers.fake_controller import fake
    app.register_blueprint(fake)

    return app
