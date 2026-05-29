import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Tenant, UserProfile, UploadBatch, EmissionRecord, AuditLog
from .serializers import (
    EmissionRecordSerializer, UploadBatchSerializer,
    AuditLogSerializer, UserSerializer
)
from .parsers import parse_sap_csv, parse_utility_csv, parse_travel_csv


# ─── AUTH ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Username and password required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    login(request, user)
    return Response({
        'message': 'Login successful',
        'user': UserSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response({'message': 'Logged out'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(UserSerializer(request.user).data)


# ─── UPLOADS ─────────────────────────────────────────────────────────────────

def handle_upload(request, source_type, parser_fn):
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    file = request.FILES['file']
    tenant = request.user.profile.tenant

    try:
        file_content = file.read().decode('utf-8')
    except UnicodeDecodeError:
        file.seek(0)
        file_content = file.read().decode('latin-1')

    batch = UploadBatch.objects.create(
        tenant=tenant,
        uploaded_by=request.user,
        source_type=source_type,
        filename=file.name,
    )

    try:
        successful, failed, failed_details = parser_fn(file_content, batch, tenant)
    except Exception as e:
        batch.delete()
        return Response(
            {'error': f'Failed to parse file: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    batch.total_rows = successful + failed
    batch.successful_rows = successful
    batch.failed_rows = failed
    batch.save()

    AuditLog.objects.create(
        tenant=tenant,
        user=request.user,
        event='upload',
        batch=batch,
        details={
            'filename': file.name,
            'source_type': source_type,
            'total_rows': successful + failed,
            'successful': successful,
            'failed': failed,
            'failed_details': failed_details[:10],
        }
    )

    return Response({
        'message': 'Upload complete',
        'batch_id': batch.id,
        'total_rows': successful + failed,
        'successful_rows': successful,
        'failed_rows': failed,
        'failed_details': failed_details[:5],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_sap(request):
    return handle_upload(request, 'sap', parse_sap_csv)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_utility(request):
    return handle_upload(request, 'utility', parse_utility_csv)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_travel(request):
    return handle_upload(request, 'travel', parse_travel_csv)


# ─── RECORDS ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def records_list(request):
    tenant = request.user.profile.tenant
    qs = EmissionRecord.objects.filter(tenant=tenant).select_related('batch', 'reviewed_by')

    status_filter = request.GET.get('status')
    category_filter = request.GET.get('category')
    source_type_filter = request.GET.get('source_type')

    if status_filter:
        qs = qs.filter(status=status_filter)
    if category_filter:
        qs = qs.filter(category=category_filter)
    if source_type_filter:
        qs = qs.filter(batch__source_type=source_type_filter)

    qs = qs.order_by('-created_at')
    return Response(EmissionRecordSerializer(qs, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def record_update(request, record_id):
    tenant = request.user.profile.tenant

    try:
        record = EmissionRecord.objects.get(id=record_id, tenant=tenant)
    except EmissionRecord.DoesNotExist:
        return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    allowed = ['approved', 'rejected', 'pending', 'suspicious']

    if new_status not in allowed:
        return Response(
            {'error': f'Status must be one of: {allowed}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    old_status = record.status
    record.status = new_status
    record.reviewed_by = request.user
    record.reviewed_at = timezone.now()
    record.save()

    AuditLog.objects.create(
        tenant=tenant,
        user=request.user,
        event='approve' if new_status == 'approved' else 'reject',
        record=record,
        details={
            'previous_status': old_status,
            'new_status': new_status,
        }
    )

    return Response(EmissionRecordSerializer(record).data)


# ─── DASHBOARD ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    tenant = request.user.profile.tenant
    qs = EmissionRecord.objects.filter(tenant=tenant)

    stats = {
        'total':      qs.count(),
        'pending':    qs.filter(status='pending').count(),
        'suspicious': qs.filter(status='suspicious').count(),
        'approved':   qs.filter(status='approved').count(),
        'rejected':   qs.filter(status='rejected').count(),
        'by_scope': {
            'scope1': qs.filter(scope='scope1').count(),
            'scope2': qs.filter(scope='scope2').count(),
            'scope3': qs.filter(scope='scope3').count(),
        },
        'by_source': {
            'sap':     qs.filter(batch__source_type='sap').count(),
            'utility': qs.filter(batch__source_type='utility').count(),
            'travel':  qs.filter(batch__source_type='travel').count(),
        },
    }

    recent_batches = UploadBatch.objects.filter(tenant=tenant).order_by('-uploaded_at')[:5]
    stats['recent_batches'] = UploadBatchSerializer(recent_batches, many=True).data

    return Response(stats)


# ─── AUDIT LOG ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_log_list(request):
    tenant = request.user.profile.tenant
    logs = AuditLog.objects.filter(tenant=tenant).order_by('-timestamp')[:50]
    return Response(AuditLogSerializer(logs, many=True).data)


# ─── ADMIN PANEL ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_tenants(request):
    """GET all tenants / POST create new tenant"""
    # Only admins can access this
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        tenants = Tenant.objects.all().order_by('-created_at')
        data = []
        for t in tenants:
            user_count = UserProfile.objects.filter(tenant=t).count()
            record_count = EmissionRecord.objects.filter(tenant=t).count()
            data.append({
                'id': t.id,
                'name': t.name,
                'slug': t.slug,
                'created_at': t.created_at,
                'user_count': user_count,
                'record_count': record_count,
            })
        return Response(data)

    if request.method == 'POST':
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Tenant name required'}, status=400)

        # Auto-generate slug from name
        slug = name.lower().replace(' ', '-').replace('_', '-')
        import re
        slug = re.sub(r'[^a-z0-9-]', '', slug)

        if Tenant.objects.filter(slug=slug).exists():
            slug = f"{slug}-{Tenant.objects.count()}"

        tenant = Tenant.objects.create(name=name, slug=slug)
        return Response({
            'id': tenant.id,
            'name': tenant.name,
            'slug': tenant.slug,
            'created_at': tenant.created_at,
            'user_count': 0,
            'record_count': 0,
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_users(request):
    """GET all users / POST create new user"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        profiles = UserProfile.objects.all().select_related('user', 'tenant')
        data = [{
            'id': p.user.id,
            'username': p.user.username,
            'email': p.user.email,
            'role': p.role,
            'tenant_id': p.tenant.id if p.tenant else None,
            'tenant_name': p.tenant.name if p.tenant else 'Platform',
            'date_joined': p.user.date_joined,
        } for p in profiles]
        return Response(data)

    if request.method == 'POST':
        username   = request.data.get('username', '').strip()
        password   = request.data.get('password', '').strip()
        email      = request.data.get('email', '').strip()
        role       = request.data.get('role', 'analyst')
        tenant_id  = request.data.get('tenant_id')

        if not all([username, password]):
            return Response({'error': 'username and password required'}, status=400)

        # Analysts must belong to a tenant, admins are platform-wide
        if role == 'analyst' and not tenant_id:
            return Response({'error': 'Analysts must be assigned to a tenant'}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already taken'}, status=400)

        tenant = None
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
            except Tenant.DoesNotExist:
                return Response({'error': 'Tenant not found'}, status=404)

        user = User.objects.create_user(username=username, password=password, email=email)
        profile = UserProfile.objects.create(user=user, tenant=tenant, role=role)

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': profile.role,
            'tenant_name': tenant.name if tenant else 'Platform',
        }, status=status.HTTP_201_CREATED)


@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    if request.method == 'DELETE':
        if user == request.user:
            return Response({'error': 'Cannot delete yourself'}, status=400)
        user.delete()
        return Response({'message': 'User deleted'})

    # PATCH — edit user
    email = request.data.get('email')
    tenant_id = request.data.get('tenant_id')

    if email is not None:
        user.email = email
        user.save()

    profile = user.profile
    if tenant_id is not None:
        if tenant_id == '' or tenant_id is None:
            profile.tenant = None
        else:
            try:
                profile.tenant = Tenant.objects.get(id=tenant_id)
            except Tenant.DoesNotExist:
                return Response({'error': 'Tenant not found'}, status=404)
        profile.save()

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': profile.role,
        'tenant_id': profile.tenant.id if profile.tenant else None,
        'tenant_name': profile.tenant.name if profile.tenant else 'Platform',
    })


@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
def delete_tenant(request, tenant_id):
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found'}, status=404)

    if request.method == 'DELETE':
        tenant.delete()
        return Response({'message': 'Tenant deleted'})

    # PATCH — edit tenant
    import re
    name = request.data.get('name', '').strip()
    if name:
        tenant.name = name
        slug = name.lower().replace(' ', '-').replace('_', '-')
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        if Tenant.objects.filter(slug=slug).exclude(id=tenant.id).exists():
            slug = f"{slug}-{tenant.id}"
        tenant.slug = slug
        tenant.save()

    return Response({
        'id': tenant.id,
        'name': tenant.name,
        'slug': tenant.slug,
    })


# ─── ADMIN: Upload Batches ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_batches(request):
    """GET all upload batches across all tenants (admin only)"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)

    batches = UploadBatch.objects.all().select_related('tenant', 'uploaded_by').order_by('-uploaded_at')
    data = [{
        'id': b.id,
        'tenant_name': b.tenant.name,
        'uploaded_by': b.uploaded_by.username if b.uploaded_by else '—',
        'source_type': b.source_type,
        'filename': b.filename,
        'uploaded_at': b.uploaded_at,
        'total_rows': b.total_rows,
        'successful_rows': b.successful_rows,
        'failed_rows': b.failed_rows,
    } for b in batches]
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_batch(request, batch_id):
    """DELETE an upload batch and all its records (admin only)"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    try:
        batch = UploadBatch.objects.get(id=batch_id)
        batch.delete()
        return Response({'message': 'Batch deleted'})
    except UploadBatch.DoesNotExist:
        return Response({'error': 'Batch not found'}, status=404)


# ─── ADMIN: Emission Records ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_records(request):
    """GET all emission records across all tenants (admin only)"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)

    qs = EmissionRecord.objects.all().select_related('tenant', 'batch', 'reviewed_by').order_by('-created_at')

    # Optional filters
    tenant_id = request.GET.get('tenant_id')
    status_filter = request.GET.get('status')
    scope_filter = request.GET.get('scope')
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    if scope_filter:
        qs = qs.filter(scope=scope_filter)

    qs = qs[:200]  # Limit for performance
    data = [{
        'id': r.id,
        'tenant_name': r.tenant.name,
        'scope': r.scope,
        'category': r.category,
        'normalized_value': r.normalized_value,
        'normalized_unit': r.normalized_unit,
        'status': r.status,
        'flag_reason': r.flag_reason,
        'source_type': r.batch.source_type,
        'filename': r.batch.filename,
        'reviewed_by': r.reviewed_by.username if r.reviewed_by else None,
        'created_at': r.created_at,
    } for r in qs]
    return Response(data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def admin_update_record(request, record_id):
    """PATCH: admin can update status of any record across all tenants"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    try:
        record = EmissionRecord.objects.get(id=record_id)
    except EmissionRecord.DoesNotExist:
        return Response({'error': 'Record not found'}, status=404)

    new_status = request.data.get('status')
    allowed = ['approved', 'rejected', 'pending', 'suspicious']
    if new_status not in allowed:
        return Response({'error': f'Status must be one of: {allowed}'}, status=400)

    old_status = record.status
    record.status = new_status
    record.reviewed_by = request.user
    record.reviewed_at = timezone.now()
    record.save()

    AuditLog.objects.create(
        tenant=record.tenant,
        user=request.user,
        event='approve' if new_status == 'approved' else 'reject',
        record=record,
        details={'previous_status': old_status, 'new_status': new_status, 'by_admin': True}
    )
    return Response({'message': 'Record updated', 'status': new_status})


# ─── ADMIN: Full Audit Log ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_audit_log(request):
    """GET full audit log across all tenants (admin only)"""
    if request.user.profile.role != 'admin':
        return Response({'error': 'Admin only'}, status=403)

    logs = AuditLog.objects.all().select_related('tenant', 'user').order_by('-timestamp')[:100]
    data = [{
        'id': l.id,
        'tenant_name': l.tenant.name if l.tenant else '—',
        'username': l.user.username if l.user else 'System',
        'event': l.event,
        'details': l.details,
        'timestamp': l.timestamp,
    } for l in logs]
    return Response(data)