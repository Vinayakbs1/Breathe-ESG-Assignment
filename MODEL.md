# MODEL.md — Data Model

## Overview

The data model is designed around four core requirements:
1. **Multi-tenancy** — complete isolation between client companies
2. **Source-of-truth tracking** — full lineage from raw file to approved record
3. **Scope 1/2/3 classification** — GHG Protocol categories baked into every record
4. **Audit trail** — immutable log of every action, who did it, and when

---

## Entity Relationship

```
Tenant
  ├── UserProfile  (role: admin | analyst)
  ├── UploadBatch  (who uploaded, when, which file, how many rows)
  │     └── EmissionRecord  (the normalized data rows)
  └── AuditLog     (every upload, approve, reject, edit)
```

---

## Table Definitions

### `Tenant`
| Field       | Type       | Notes                                  |
|-------------|------------|----------------------------------------|
| id          | AutoField  | PK                                     |
| name        | CharField  | Human-readable company name            |
| slug        | SlugField  | URL-safe unique identifier             |
| created_at  | DateTime   | Auto-set on creation                   |

**Why**: Every record, user, batch and audit log entry belongs to a tenant. This is the isolation boundary. A query for any data always filters `WHERE tenant_id = <current_user.tenant_id>`, preventing cross-tenant data leakage.

---

### `UserProfile`
| Field  | Type        | Notes                                             |
|--------|-------------|---------------------------------------------------|
| user   | FK → User   | Django's built-in auth user (password, sessions)  |
| tenant | FK → Tenant | `null=True` for platform admins                   |
| role   | CharField   | `analyst` or `admin`                              |

**Why**: We extend Django's User rather than replace it to keep session auth, password hashing, and the admin interface for free. The `tenant` field is nullable specifically for platform-wide admin accounts who manage tenants but don't belong to one.

**Role separation**:
- `admin` — can create/edit/delete tenants and users. No access to data.
- `analyst` — can upload CSVs, view their tenant's records, approve/reject.

---

### `UploadBatch`
| Field           | Type         | Notes                                   |
|-----------------|--------------|-----------------------------------------|
| tenant          | FK → Tenant  |                                         |
| uploaded_by     | FK → User    | SET_NULL on delete (preserves history)  |
| source_type     | CharField    | `sap`, `utility`, or `travel`           |
| filename        | CharField    | Original file name                      |
| uploaded_at     | DateTime     | Auto-set                                |
| total_rows      | IntegerField | Rows attempted                          |
| successful_rows | IntegerField | Rows parsed and stored                  |
| failed_rows     | IntegerField | Rows rejected at parse time             |

**Why this exists as a separate model**: Every `EmissionRecord` links back to its batch, which links back to the original file upload. This answers "where did this number come from?" — critical for auditors. Without a batch model, you lose the connection between a record and the file that produced it.

---

### `EmissionRecord`
| Field            | Type         | Notes                                             |
|------------------|--------------|---------------------------------------------------|
| tenant           | FK → Tenant  | Direct denormalization for fast queries           |
| batch            | FK → Batch   | Which upload produced this row                    |
| scope            | CharField    | `scope1`, `scope2`, `scope3`                      |
| category         | CharField    | `fuel`, `electricity`, `flight`, `hotel`, etc.    |
| raw_value        | FloatField   | Exactly what was in the source file               |
| raw_unit         | CharField    | Original unit (GAL, LTR, MWh, miles…)             |
| normalized_value | FloatField   | After unit conversion                             |
| normalized_unit  | CharField    | Always: liters (fuel), kWh (electricity), km (travel) |
| metadata         | JSONField    | Source-specific extras (plant code, meter ID, employee name) |
| status           | CharField    | `pending` → `approved` or `rejected`              |
| flag_reason      | TextField    | Why the record was auto-flagged as suspicious     |
| reviewed_by      | FK → User    | SET_NULL on delete                                |
| reviewed_at      | DateTime     | When approval/rejection happened                  |
| created_at       | DateTime     | Row creation time                                 |
| updated_at       | DateTime     | Auto-updated on every save                        |

**Why we store both raw and normalized**: The raw value is immutable evidence of what came from the source. The normalized value is what analysts and auditors work with. Storing both means you can always re-derive the conversion, spot errors, and satisfy "show me the original".

**Why tenant is denormalized here**: `batch → tenant` already gives you the tenant, but filtering `EmissionRecord.objects.filter(tenant=t)` is far faster than `filter(batch__tenant=t)` — especially with millions of rows.

**Why JSONField for metadata**: Each source type has completely different extra fields (SAP has plant codes and cost centres; travel has origin/destination airports; utility has meter IDs and billing periods). A JSONField avoids creating three separate tables or a massive sparse row with 20 nullable columns.

---

### `AuditLog`
| Field     | Type           | Notes                                       |
|-----------|----------------|---------------------------------------------|
| tenant    | FK → Tenant    |                                             |
| user      | FK → User      | SET_NULL on delete — event is preserved     |
| event     | CharField      | `upload`, `approve`, `reject`, `edit`       |
| record    | FK → Record    | Nullable — upload events have no record     |
| batch     | FK → Batch     | Nullable — approve/reject have no batch     |
| details   | JSONField      | Extra context (old/new status, row counts)  |
| timestamp | DateTime       | Auto-set, never updated                     |

**Why this is append-only**: The audit log has no `update` or `delete` endpoints. It is written to and never touched again. This is the only model with a `class Meta: ordering = ['-timestamp']` — all other queries are time-sorted at the view layer.

---

## Scope Classification Logic

| Source  | Scope  | Category          | Rationale                                    |
|---------|--------|-------------------|----------------------------------------------|
| SAP     | Scope 1 | fuel, procurement | Direct combustion of fuel at company facilities |
| Utility | Scope 2 | electricity       | Purchased electricity (indirect emissions)    |
| Travel  | Scope 3 | flight, hotel, ground_transport | All other indirect — employee travel |

Scope is set at parse time by the upload view, not by the user. This ensures consistent classification regardless of analyst.

---

## Unit Normalization

| Source  | Raw units seen         | Normalized to |
|---------|------------------------|---------------|
| SAP     | L, LTR, LITER, GAL, KG | liters        |
| Utility | kWh, MWh, Wh           | kWh           |
| Travel  | miles, km, (estimated) | km            |

Conversion factors are hardcoded constants in `views.py`. In production these would live in a config table to support updates without a code deploy.

---

## What Would Break at Scale

- **SQLite in production**: The current prototype uses SQLite. At >10k records, full-table scans on `EmissionRecord` will become slow. Switch to PostgreSQL and add indexes on `(tenant, status)` and `(tenant, batch)`.
- **No soft deletes**: Deleting a tenant cascades and permanently removes all their data. In production, tenant deactivation should be a flag, not a DELETE.
- **Float precision**: `FloatField` can lose precision for very large or very small values. `DecimalField` with fixed precision would be safer for financial/carbon accounting.
