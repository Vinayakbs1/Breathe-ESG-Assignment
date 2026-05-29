# TRADEOFFS.md — What We Deliberately Did Not Build

## 1. CO₂e Calculation and Emission Factors

**What it would be**: Converting normalized consumption values (liters of fuel, kWh of electricity, km of travel) into tonnes of CO₂ equivalent using published emission factors.

**Why we skipped it**: Emission factors are not universal — they vary by:
- Fuel type (diesel vs. petrol vs. LPG have different kgCO2e/liter)
- Country grid mix (Indian electricity in 2024 has a very different emission factor than Norwegian)
- Reporting year (IPCC, DEFRA, EPA publish annual updates)
- Scope 2 method (location-based vs. market-based)

Using the wrong emission factor produces numbers that look precise but are wrong. The cost of a wrong CO₂e calculation in an audit submission is much higher than not computing it at all. This platform's job — as scoped by the brief — is ingestion and review, not carbon accounting. CO₂e computation belongs in a dedicated carbon accounting tool (Watershed, Persefoni, etc.) that maintains vetted factor libraries.

**What would be needed to add it**: A `EmissionFactor` model keyed on (category, fuel_type, country, year, source), a factor management UI for the admin, and a recalculation job when factors are updated. Estimated: 3–5 additional days.

---

## 2. Real-Time Collaboration and Record Assignment

**What it would be**: Assigning specific records or batches to specific analysts, conflict detection when two analysts review the same record simultaneously, and notifications (email / in-app) when a batch needs review.

**Why we skipped it**: With 1–2 analysts per tenant in the stated use case, queue-based assignment is unnecessary overhead. Every analyst sees every pending record for their tenant. If two analysts try to approve the same record at the same time, the last write wins — acceptable for a prototype.

**The real problem**: In a real enterprise deployment with 10+ analysts and thousands of records per upload, uncoordinated review creates:
- Duplicate work (two analysts review the same record)
- Gaps (no one reviews a specific record)
- No accountability (who was responsible for this batch?)

**What would be needed**: A `ReviewAssignment` model, a WebSocket or polling mechanism for live status updates, and email/Slack integration for notifications. Estimated: 1–2 sprint weeks.

---

## 3. File Validation and Schema Enforcement Before Processing

**What it would be**: A pre-upload validation step that checks the CSV schema before processing any rows — confirming required columns exist, data types are correct, and the file isn't malformed — and returning a detailed validation report to the analyst before a single record is written to the database.

**Why we skipped it**: The current pipeline processes rows one by one: valid rows succeed, invalid rows are counted in `failed_rows`. This is simple and works, but has two problems:

1. **Partial imports**: If a 10,000-row file has a bad column header, 9,980 rows might succeed and 20 fail. The analyst is left with a partially-imported batch that's hard to reason about.
2. **Silent schema drift**: If SAP changes its export format (renames a column, adds a decimal separator), rows silently fail without a clear explanation.

**What we do instead**: Flag individual row failures in `failed_details` and surface them in the upload result. This is good enough for a prototype but brittle for production.

**What would be needed**: A two-phase upload: (1) validate the entire file and return a schema report, (2) if the analyst confirms, process and import. A `ValidationReport` model to store issues per row/column. Estimated: 3–4 additional days.
