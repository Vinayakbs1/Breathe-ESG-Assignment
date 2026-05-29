from django.db import models
from django.contrib.auth.models import User


class Tenant(models.Model):
    """
    A company/client using the platform.
    Multi-tenancy: every piece of data belongs to a tenant.
    Users from Acme Corp cannot see Green Energy Ltd's data.
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)  # e.g. 'acme-corp'
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """
    Extends Django's built-in User with tenant and role info.
    We use Django's User for auth (login/password), this model adds our fields.
    """
    ROLE_CHOICES = [
        ('analyst', 'Analyst'),
        ('admin', 'Admin'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='analyst')

    def __str__(self):
        if self.tenant:
            return f"{self.user.username} ({self.tenant.name})"
        return f"{self.user.username} (Platform Admin)"


class UploadBatch(models.Model):
    """
    Tracks each file upload event.
    If someone uploads a CSV, we create one UploadBatch.
    All rows from that CSV link back to this batch.
    This gives us: who uploaded, when, how many rows succeeded/failed.
    """
    SOURCE_TYPES = [
        ('sap', 'SAP Export'),
        ('utility', 'Utility Data'),
        ('travel', 'Corporate Travel'),
    ]
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    total_rows = models.IntegerField(default=0)
    successful_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.source_type} upload by {self.uploaded_by} at {self.uploaded_at}"


class EmissionRecord(models.Model):
    """
    The core normalized record. Every row from every source ends up here.

    KEY DESIGN DECISION:
    We store BOTH the raw value (what came in) and normalized value (what we converted to).
    This is critical for audit — you can always see the original data.

    Scope classification:
    - Scope 1: Direct emissions (fuel combustion) — SAP fuel data
    - Scope 2: Indirect from electricity — Utility data
    - Scope 3: All other indirect (travel, supply chain) — Travel data
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('suspicious', 'Suspicious'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    SCOPE_CHOICES = [
        ('scope1', 'Scope 1 - Direct'),
        ('scope2', 'Scope 2 - Electricity'),
        ('scope3', 'Scope 3 - Indirect'),
    ]

    CATEGORY_CHOICES = [
        ('fuel', 'Fuel Combustion'),
        ('electricity', 'Electricity'),
        ('flight', 'Air Travel'),
        ('hotel', 'Hotel Stay'),
        ('ground_transport', 'Ground Transport'),
        ('procurement', 'Procurement'),
    ]

    # Ownership & lineage
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name='records')

    # Classification
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)

    # Raw data exactly as it came from the source file
    raw_value = models.FloatField()
    raw_unit = models.CharField(max_length=50)

    # Normalized data after conversion
    normalized_value = models.FloatField()
    normalized_unit = models.CharField(max_length=50)  # always kWh, liters, or km

    # Source-specific metadata stored as JSON
    # SAP: plant_code, fuel_type, purchase_date
    # Utility: meter_id, billing_period, tariff
    # Travel: employee, origin, destination, travel_type
    metadata = models.JSONField(default=dict)

    # Status & flags
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    flag_reason = models.TextField(blank=True)  # why it was flagged suspicious

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Who reviewed it
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_records'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.category} | {self.normalized_value} {self.normalized_unit} | {self.status}"


class AuditLog(models.Model):
    """
    Immutable log of every action taken on the platform.
    NEVER delete or edit rows here. This is your audit trail.
    """
    EVENT_CHOICES = [
        ('upload', 'File Uploaded'),
        ('approve', 'Record Approved'),
        ('reject', 'Record Rejected'),
        ('edit', 'Record Edited'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    record = models.ForeignKey(
        EmissionRecord, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    batch = models.ForeignKey(
        UploadBatch, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    details = models.JSONField(default=dict)  # any extra context
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.event} by {self.user} at {self.timestamp}"