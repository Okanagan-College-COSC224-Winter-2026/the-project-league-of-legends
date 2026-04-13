from api import create_app
from api.models import User

app = create_app()
with app.app_context():
    users = User.query.all()
    print(f"Total users: {len(users)}")
    for user in users:
        print(f"  - {user.name} ({user.email}) - {user.role}")
    
    # Check if we have an admin
    admin = User.query.filter(User.role == "admin").first()
    if admin:
        print(f"\nAdmin found: {admin.name} ({admin.email})")
    else:
        print("\nNo admin user found!")
