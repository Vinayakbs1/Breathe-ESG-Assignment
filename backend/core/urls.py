from django.contrib import admin
from django.urls import path, re_path
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.views.generic import TemplateView
from django.conf import settings
from emissions import views
import os

def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})

# Serve React SPA index.html for non-API routes
def spa_view(request):
    """Serve the React SPA. In production, the built index.html is in staticfiles."""
    import os
    from django.http import HttpResponse
    
    # Try the built frontend index.html
    index_path = os.path.join(settings.BASE_DIR, 'staticfiles', 'index.html')
    if not os.path.exists(index_path):
        # Fallback: maybe in frontend/dist during dev
        index_path = os.path.join(settings.BASE_DIR, '..', 'frontend', 'dist', 'index.html')
    
    if os.path.exists(index_path):
        with open(index_path, 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')
    
    return HttpResponse('Frontend not built. Run: cd frontend && npm run build', status=404)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/csrf/', csrf_token_view),

    # Auth
    path('api/auth/login/',    views.login_view),
    path('api/auth/logout/',   views.logout_view),
    path('api/auth/me/',       views.current_user),

    # Uploads
    path('api/upload/sap/',     views.upload_sap),
    path('api/upload/utility/', views.upload_utility),
    path('api/upload/travel/',  views.upload_travel),

    # Records
    path('api/records/',                 views.records_list),
    path('api/records/<int:record_id>/', views.record_update),

    # Dashboard & Audit
    path('api/dashboard/', views.dashboard_stats),
    path('api/audit/',     views.audit_log_list),

    # Admin panel
    path('api/admin/tenants/',                views.manage_tenants),
    path('api/admin/tenants/<int:tenant_id>/', views.delete_tenant),
    path('api/admin/users/',                  views.manage_users),
    path('api/admin/users/<int:user_id>/',    views.delete_user),

    # Catch-all: serve React SPA for any non-API route
    re_path(r'^(?!api/).*$', spa_view),
]