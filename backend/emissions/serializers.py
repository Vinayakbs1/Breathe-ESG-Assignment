from rest_framework import serializers  # type: ignore
from django.contrib.auth.models import User
from .models import Tenant, UserProfile, UploadBatch, EmissionRecord, AuditLog


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug']


class UserSerializer(serializers.ModelSerializer):
    # We go "through" UserProfile to get tenant and role
    # SerializerMethodField means we write a custom function to get the value
    tenant = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'tenant', 'role']

    def get_tenant(self, obj):
        # obj is the User instance
        # obj.profile is the related UserProfile (because of related_name='profile')
        if hasattr(obj, 'profile') and obj.profile.tenant:
            return {'id': obj.profile.tenant.id, 'name': obj.profile.tenant.name}
        return None

    def get_role(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.role
        return None


class UploadBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UploadBatch
        fields = [
            'id', 'source_type', 'filename', 'uploaded_at',
            'total_rows', 'successful_rows', 'failed_rows', 'uploaded_by_name'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.username
        return 'Unknown'


class EmissionRecordSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.SerializerMethodField()
    batch_info = serializers.SerializerMethodField()

    class Meta:
        model = EmissionRecord
        fields = [
            'id', 'scope', 'category',
            'raw_value', 'raw_unit',
            'normalized_value', 'normalized_unit',
            'metadata', 'status', 'flag_reason',
            'created_at', 'updated_at',
            'reviewed_by_name', 'reviewed_at',
            'batch_info'
        ]

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.username
        return None

    def get_batch_info(self, obj):
        return {
            'id': obj.batch.id,
            'source_type': obj.batch.source_type,
            'filename': obj.batch.filename,
        }


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'event', 'username', 'details', 'timestamp']

    def get_username(self, obj):
        if obj.user:
            return obj.user.username
        return 'System'