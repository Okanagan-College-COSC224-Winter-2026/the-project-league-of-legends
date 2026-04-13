from api import create_app

app = create_app()
print("All routes:")
for rule in app.url_map.iter_rules():
    if 'admin' in str(rule):
        print(f"  {rule}")
