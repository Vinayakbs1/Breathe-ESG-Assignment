#!/usr/bin/env bash
set -o errexit

# 1. Install Python deps
pip install -r requirements.txt

# 2. Build the React frontend
cd ../frontend
npm install
npm run build
cd ../backend

# 3. Copy built frontend into Django's staticfiles directory
mkdir -p staticfiles
# Copy index.html (served by the catch-all view)
cp ../frontend/dist/index.html staticfiles/index.html
# Copy all assets (JS, CSS, images) into staticfiles
cp -r ../frontend/dist/assets staticfiles/assets 2>/dev/null || true

# 4. Collect Django's own static files (admin, DRF)
python manage.py collectstatic --no-input

# 5. Run database migrations
python manage.py migrate

# 6. Create initial users if they don't exist
python manage.py shell << 'PYEOF'
from django.contrib.auth.models import User
from emissions.models import UserProfile, Tenant

if not User.objects.filter(username='admin').exists():
    u = User.objects.create_user('admin', 'admin@breatheesg.com', 'Admin@123')
    UserProfile.objects.create(user=u, role='admin', tenant=None)
    print('Created admin user')
else:
    print('Admin already exists')

if not User.objects.filter(username='analyst').exists():
    t, _ = Tenant.objects.get_or_create(name='Demo Corp', slug='demo-corp')
    u = User.objects.create_user('analyst', 'analyst@demo.com', 'analyst123')
    UserProfile.objects.create(user=u, role='analyst', tenant=t)
    print('Created analyst user')
else:
    print('Analyst already exists')

print('Build complete.')
PYEOF
