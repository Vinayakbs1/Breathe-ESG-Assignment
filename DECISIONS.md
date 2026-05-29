# DECISIONS.md — Design Decisions & Ambiguities

## Summary

This document covers every meaningful decision made during the 4-day build, what was chosen, why, and what I'd ask the PM before building the real version.

---

## 1. Authentication Strategy

**Decision**: Django session authentication via `SessionAuthentication`.

**Why**: Session cookies are HTTP-only, CSRF-protected by default, and require no token management on the client. For a React SPA hitting the same origin (proxied via Vite), sessions are simpler and more secure than JWTs for this use case.

**Tradeoff**: Sessions don't work well for mobile apps or third-party API clients. If this needs to become a public API, JWTs would be the right choice.

**What I'd ask**: Will this API ever be consumed by non-browser clients (mobile app, external integrations)? If yes, switch to token auth now.

---

## 2. Role Model: Two Roles Only

**Decision**: Only `admin` (platform-wide) and `analyst` (per-tenant) roles.

**Why**: The brief says "analysts review and sign off." There's no mention of a read-only viewer, a manager approver, or a super-analyst. Adding roles speculatively creates complexity with no stated benefit.

**What I'd ask**:
- Can any analyst approve any record, or do records need to be assigned?
- Is there a "manager sign-off" step after analyst approval before auditors see it?
- Can analysts delete records they uploaded, or is that locked?

---

## 3. Tenant Isolation at the Query Layer

**Decision**: Every data query filters on `request.user.profile.tenant`. No cross-tenant queries for analysts.

**Why**: Hard-coded in the view — even if a malicious user crafts a request with a different record ID, the view validates that `record.tenant == request.user.profile.tenant`. This is defense in depth beyond just URL authorization.

**What I'd ask**: Does the PM expect any cross-tenant reporting (e.g., a "total platform emissions" dashboard for the admin)? The current model makes that straightforward to add since tenant is on every record.

---

## 4. Which Subset of SAP Data to Handle

**Decision**: Handled MB51 (material movements) and ME2M (purchase orders) format columns. Specifically:
- Material/fuel quantities and units
- Plant code and cost centre as metadata
- Booking/document date for temporal tracking

**Ignored**:
- SAP cost data (Wert/Amount fields) — irrelevant for emissions
- Company code vs. plant code disambiguation — treated plant code as the primary identifier
- Currency fields
- Reversal/cancellation documents (negative quantity rows are flagged as suspicious)

**What I'd ask**: Are there reversal documents in your SAP export? Negative quantities flag as suspicious currently — should they cancel a prior row instead?

---

## 5. Which Subset of Utility Data to Handle

**Decision**: Handled:
- Account/meter identifier
- Billing period start and end dates
- kWh or MWh consumption value

**Ignored**:
- Tariff rates and cost data
- Peak vs. off-peak consumption splits
- Renewable energy certificates (RECs/GOOs) — material for Scope 2 market-based accounting
- Multi-currency bills

**What I'd ask**: Is the client using location-based or market-based Scope 2 accounting? Market-based requires tracking RECs separately, which changes the data model significantly.

---

## 6. Which Subset of Travel Data to Handle

**Decision**: Handled:
- Flight segments with origin/destination IATA codes
- Hotel nights
- Ground transport (taxi, car, train) with approximate distances

**Ignored**:
- Cabin class (economy vs. business class has ~3× emissions multiplier)
- Rail vs. car vs. taxi distinction for ground transport
- Rideshare vs. rental car
- International vs. domestic hotel emission factors

**What I'd ask**: Do you need cabin class tracking? Business class emissions are ~3× economy — for a large enterprise client with frequent flyers this is a material difference.

---

## 7. Unit Normalization: Hardcoded Factors

**Decision**: Conversion factors (GAL → L = 3.785, MWh → kWh = 1000, miles → km = 1.609) are constants in `views.py`.

**Why**: For a 4-day prototype, hardcoding is fast and explicit. The values are standard and don't change.

**What I'd ask for production**: Where should conversion factors live? A config table in the DB (changeable without a deploy), a constants file (auditable via git), or an external data service?

---

## 8. Suspicious Record Flagging

**Decision**: Auto-flag records as `suspicious` if:
- Value is 0 or negative
- Value is more than 10× the average for that category in this tenant's data

**Why**: Simple heuristics that catch the most common data quality issues in enterprise exports (null columns, reversed sign conventions). More sophisticated ML-based anomaly detection is out of scope for a prototype.

**What I'd ask**: Do you want analysts to set custom thresholds per tenant? Or is "10× average" a reasonable starting point?

---

## 9. No Emission Factor Conversion to CO₂e

**Decision**: Records store consumption values (liters, kWh, km) — not computed CO₂e tonnes.

**Why**: Emission factors (e.g., kgCO2e per liter of diesel) vary by fuel type, country grid mix, and reporting year. Getting these wrong would be worse than not computing them. The platform's stated job is data ingestion and review, not carbon calculation.

**What I'd ask**: Should this platform compute CO₂e, or does that happen downstream in your carbon accounting tool? If here, which emission factor database do you use (IPCC, DEFRA, EPA)?

---

## 10. Frontend: React SPA vs. Server-Rendered

**Decision**: Vite + React SPA, proxied to Django backend.

**Why**: The brief says "Django and React." The SPA approach gives a fast, interactive review workflow without full-page reloads on every approve/reject. The Vite proxy means no CORS configuration needed in development.

**For production**: The frontend is built to static files and served from Render's CDN (static site). The backend is a separate Render web service.
