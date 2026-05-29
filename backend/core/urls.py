from django.contrib import admin
from django.urls import path
from django.middleware.csrf import get_token
from django.http import JsonResponse
from emissions import views

def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})

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
]