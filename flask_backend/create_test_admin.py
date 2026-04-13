from api import create_app
from api.models import User
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    # Delete existing test admin if exists
    existing = User.query.filter(User.email == "test.admin@example.com").first()
    if existing:
        existing.delete()
    
    # Create new admin
    admin = User(
        name="Test Admin",
        email="test.admin@example.com",
        hash_pass=generate_password_hash("testpass123"),
        role="admin"
    )
    User.create_user(admin)
    print(f"Created admin: test.admin@example.com / testpass123")
