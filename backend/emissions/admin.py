from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count
from .models import Tenant, UserProfile, UploadBatch, EmissionRecord, AuditLog

# ─── Customize the Admin Site Header ─────────────────────────────────────────
admin.site.site_header = "🌿 BreatheESG Admin"
admin.site.site_title = "BreatheESG Admin"
admin.site.index_title = "Platform Management"


# ─── Inline: UserProfile inside User ─────────────────────────────────────────
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "Profile"
    verbose_name_plural = "Profile"
    extra = 0


# ─── Tenant ──────────────────────────────────────────────────────────────────
@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display  = ('name', 'slug', 'user_count', 'record_count', 'created_at')
    search_fields = ('name', 'slug')
    ordering      = ('-created_at',)
    readonly_fields = ('slug', 'created_at')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            _user_count=Count('userprofile', distinct=True),
            _record_count=Count('emissionrecord', distinct=True),
        )

    def user_count(self, obj):
        return obj._user_count
    user_count.short_description = 'Users'
    user_count.admin_order_field = '_user_count'

    def record_count(self, obj):
        return obj._record_count
    record_count.short_description = 'Records'
    record_count.admin_order_field = '_record_count'


# ─── UserProfile ─────────────────────────────────────────────────────────────
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display  = ('user', 'tenant', 'role_badge', 'date_joined')
    list_filter   = ('role', 'tenant')
    search_fields = ('user__username', 'user__email', 'tenant__name')
    autocomplete_fields = ['tenant']
    ordering = ('user__username',)

    def role_badge(self, obj):
        color = '#92400e' if obj.role == 'admin' else '#166534'
        bg = '#fef3c7' if obj.role == 'admin' else '#dcfce7'
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">{}</span>',
            bg, color, obj.role.capitalize()
        )
    role_badge.short_description = 'Role'

    def date_joined(self, obj):
        return obj.user.date_joined.strftime('%d %b %Y')
    date_joined.short_description = 'Joined'


# ─── UploadBatch ─────────────────────────────────────────────────────────────
@admin.register(UploadBatch)
class UploadBatchAdmin(admin.ModelAdmin):
    list_display  = ('filename', 'tenant', 'uploaded_by', 'source_type_badge',
                     'total_rows', 'success_rate', 'uploaded_at')
    list_filter   = ('source_type', 'tenant', 'uploaded_at')
    search_fields = ('filename', 'tenant__name', 'uploaded_by__username')
    readonly_fields = ('uploaded_at', 'total_rows', 'successful_rows', 'failed_rows')
    ordering = ('-uploaded_at',)

    def source_type_badge(self, obj):
        colors = {'sap': ('#1e40af', '#dbeafe'), 'utility': ('#065f46', '#d1fae5'), 'travel': ('#7c3aed', '#ede9fe')}
        fg, bg = colors.get(obj.source_type, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">{}</span>',
            bg, fg, obj.source_type.upper()
        )
    source_type_badge.short_description = 'Source'

    def success_rate(self, obj):
        if obj.total_rows == 0:
            return '—'
        pct = round(obj.successful_rows / obj.total_rows * 100)
        color = '#16a34a' if pct >= 80 else '#d97706' if pct >= 50 else '#dc2626'
        return format_html('<span style="color:{};font-weight:600">{}%</span>', color, pct)
    success_rate.short_description = 'Success Rate'


# ─── EmissionRecord ───────────────────────────────────────────────────────────
@admin.register(EmissionRecord)
class EmissionRecordAdmin(admin.ModelAdmin):
    list_display  = ('id', 'tenant', 'scope_badge', 'category', 'normalized_value',
                     'normalized_unit', 'status_badge', 'reviewed_by', 'created_at')
    list_filter   = ('status', 'scope', 'category', 'tenant', 'batch__source_type')
    search_fields = ('tenant__name', 'category', 'flag_reason')
    readonly_fields = ('created_at', 'updated_at', 'reviewed_at')
    ordering = ('-created_at',)
    list_per_page = 50

    fieldsets = (
        ('Ownership', {
            'fields': ('tenant', 'batch')
        }),
        ('Classification', {
            'fields': ('scope', 'category')
        }),
        ('Values', {
            'fields': (('raw_value', 'raw_unit'), ('normalized_value', 'normalized_unit'))
        }),
        ('Status & Review', {
            'fields': ('status', 'flag_reason', 'reviewed_by', 'reviewed_at')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def scope_badge(self, obj):
        colors = {
            'scope1': ('#1e40af', '#dbeafe'),
            'scope2': ('#065f46', '#d1fae5'),
            'scope3': ('#7c3aed', '#ede9fe'),
        }
        fg, bg = colors.get(obj.scope, ('#374151', '#f3f4f6'))
        label = obj.scope.replace('scope', 'Scope ')
        return format_html(
            '<span style="background:{};color:{};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">{}</span>',
            bg, fg, label
        )
    scope_badge.short_description = 'Scope'

    def status_badge(self, obj):
        colors = {
            'pending':    ('#92400e', '#fef3c7'),
            'suspicious': ('#991b1b', '#fee2e2'),
            'approved':   ('#065f46', '#d1fae5'),
            'rejected':   ('#374151', '#f3f4f6'),
        }
        fg, bg = colors.get(obj.status, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">{}</span>',
            bg, fg, obj.status.capitalize()
        )
    status_badge.short_description = 'Status'


# ─── AuditLog ─────────────────────────────────────────────────────────────────
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display  = ('timestamp', 'tenant', 'user', 'event_badge', 'details_summary')
    list_filter   = ('event', 'tenant', 'timestamp')
    search_fields = ('user__username', 'tenant__name')
    readonly_fields = ('tenant', 'user', 'event', 'record', 'batch', 'details', 'timestamp')
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False  # Audit logs are immutable — never create manually

    def has_change_permission(self, request, obj=None):
        return False  # Audit logs are immutable — never edit

    def event_badge(self, obj):
        colors = {
            'upload':  ('#1e40af', '#dbeafe'),
            'approve': ('#065f46', '#d1fae5'),
            'reject':  ('#991b1b', '#fee2e2'),
            'edit':    ('#7c3aed', '#ede9fe'),
        }
        fg, bg = colors.get(obj.event, ('#374151', '#f3f4f6'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">{}</span>',
            bg, fg, obj.event.capitalize()
        )
    event_badge.short_description = 'Event'

    def details_summary(self, obj):
        d = obj.details
        if obj.event == 'upload':
            return f"{d.get('filename','?')} — {d.get('successful', 0)}/{d.get('total_rows', 0)} rows OK"
        if obj.event in ('approve', 'reject'):
            return f"{d.get('previous_status','?')} → {d.get('new_status','?')}"
        return str(d)[:80]
    details_summary.short_description = 'Details'