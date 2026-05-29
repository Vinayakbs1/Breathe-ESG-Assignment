#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Create initial users if they don't exist yet (runs on every deploy, idempotent)
python manage.py shell << 'EOF'
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

print('Setup done.')
EOF
