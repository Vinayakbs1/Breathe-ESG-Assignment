# SOURCES.md — Data Source Research

## Source 1: SAP Export (Fuel & Procurement)

### What real-world SAP exports look like

SAP exports used for sustainability/emissions reporting typically come from two transactions:

- **MB51** (Material Document List) — tracks material movements including fuel receipts and consumption. Columns include: Material, Plant, Storage Location, Quantity (`Menge`), Unit of Measure (`ME`), Posting Date (`Buchungsdatum`), Movement Type (`Bewegungsart`).
- **ME2M** (Purchase Orders by Material) — tracks procurement. Columns include: PO Number, Material, Vendor, Order Quantity, Unit, Delivery Date, Cost Centre.

**Key complexity**: SAP is heavily customized per-client. Column headers often appear in the language of the SAP system's locale — German headers (`Menge` for quantity, `Buchungsdatum` for date) are extremely common in enterprise clients regardless of their country. Date formats vary: `DD.MM.YYYY` (German locale), `MM/DD/YYYY` (US), `YYYY-MM-DD` (ISO), sometimes all in the same file.

Units are a major pain point. A single export can have: `L`, `LTR`, `LITER` for liters, `GAL` for US gallons, `KG` for kilograms of LPG. Movement type 101 is a goods receipt; 261 is a goods issue (consumption). Reversals appear as negative quantities.

### What we learned
- Must normalize column names (case-insensitive, strip whitespace)
- Must handle German and English header variants
- Multiple date formats in a single file are common
- Negative quantities = reversals, not data errors — these should cancel prior records, not fail
- Cost centre and plant code are useful metadata for internal reporting

### What our sample data looks like

```csv
Buchungsdatum,Menge,ME,Material,Werk,Kostenstelle,Bewegungsart
01.04.2024,500,LTR,DIESEL-B7,PLANT01,CC-MFGR,261
15.04.2024,250,GAL,PETROL-95,PLANT02,CC-ADMIN,261
01.05.2024,-100,LTR,DIESEL-B7,PLANT01,CC-MFGR,262
```

We chose diesel and petrol as fuel types because they cover >80% of Scope 1 fuel consumption for a typical manufacturing/logistics client. We included a reversal row (negative quantity) to demonstrate suspicious flagging.

### What would break in real deployment
1. **Reversal documents**: Negative quantities are flagged suspicious in our prototype. In reality, a reversal should cancel a specific prior document — requiring document ID matching we don't have.
2. **Movement type filtering**: We accept all movement types. In production, you'd filter to only consumption movements (261, 262) and exclude receipts (101) to avoid double-counting.
3. **Material master**: We infer "this is a fuel" from the material name. Real deployments need a mapping from SAP material codes to fuel types maintained by the client.
4. **Multi-plant, multi-currency**: We take plant code as metadata but don't compute per-plant emissions or handle purchase orders in non-local currency.

---

## Source 2: Utility Portal CSV (Electricity)

### What real-world utility portal exports look like

Indian utility portals (BESCOM, TATA Power, MSEDCL) and international ones (National Grid, EDF) export billing data as CSVs. Typical columns: Account Number, Meter ID, Billing Period (Start), Billing Period (End), Consumption (kWh or MWh), Peak Consumption, Off-Peak Consumption, Billed Amount.

**Key complexity**: Billing periods are not calendar months. A "March" bill might run 18-Feb to 21-Mar. For emissions reporting you need to allocate consumption to the correct calendar period. Duplicate bills are common — a client might export the same billing period twice (the bill was revised). Units vary: some portals report in kWh, others in MWh (BESCOM defaults to kWh, some industrial portals use MWh).

Multi-facility clients have dozens of meters in one export — meter IDs must be tracked so an analyst can see which facility drove consumption.

### What we learned
- Billing period columns are often labeled inconsistently: "Start Date", "From", "Period Beginning", "Billing Start"
- kWh vs. MWh is a 1000× error if not caught — a large bill in MWh misread as kWh inflates consumption massively
- Duplicate detection requires period-overlap logic, not just duplicate row detection

### What our sample data looks like

```csv
account_id,meter_id,period_start,period_end,consumption,unit
ACC001,MTR-A1,2024-01-15,2024-02-18,12500,kWh
ACC001,MTR-A2,2024-01-15,2024-02-18,8.5,MWh
ACC001,MTR-A1,2024-01-15,2024-02-18,12500,kWh
```

Row 1 and Row 3 are duplicates — same meter, same period, same value. Row 2 is in MWh (normalized to 8500 kWh). The duplicate is flagged suspicious.

We chose residential-scale kWh and MWh values (5k–15k kWh per month) to represent a mid-sized commercial facility.

### What would break in real deployment
1. **Billing period allocation**: We take period_start as the "date" of the record. Proper Scope 2 reporting requires pro-rating consumption across the months a billing period spans.
2. **Market-based vs. location-based**: If the client purchases renewable energy certificates (RECs), market-based Scope 2 emissions could be zero even with high kWh consumption. We don't track RECs.
3. **Revised bills**: Utilities sometimes issue revised bills for the same period. We flag duplicates as suspicious — an analyst must manually resolve which bill is correct.
4. **Peak/off-peak splits**: Some clients need this for time-of-use tariff analysis. We only track total consumption.

---

## Source 3: Corporate Travel (Concur / Navan)

### What real-world travel platform exports look like

Concur (SAP) and Navan (formerly TripActions) export trip data as CSVs. Typical columns: Employee ID, Trip ID, Departure Date, Origin, Destination, Transport Type (Air/Rail/Car/Hotel), Distance (miles or km), Cost.

**Key complexity**: Flight distance is often missing — Concur exports origin/destination IATA codes but not the distance. Hotel emissions require "room nights" not cost. Ground transport mixes car rental, taxi, rideshare, and rail with wildly different emission factors. Cabin class (economy/business/first) multiplies flight emissions by 1×/3×/4× — frequently absent from exports.

### What we learned
- IATA airport codes (LHR, BOM, JFK) are the most reliable identifiers for flights
- Most travel exports are in miles (US-centric platforms) even for international trips — miles → km conversion essential
- "Ground transport" is a catch-all that can mean anything from a 2 km taxi to a 500 km car rental
- Hotel nights are sometimes absent — only the hotel cost is exported, and cost-based emission factors are very imprecise

### What our sample data looks like

```csv
employee_id,trip_date,origin,destination,transport_type,distance,distance_unit,nights
EMP001,2024-03-15,BOM,LHR,flight,,,
EMP002,2024-03-16,,,hotel,,,3
EMP003,2024-03-17,NYC,BOS,ground,,miles,
EMP001,2024-03-18,LHR,BOM,flight,4478,miles,
```

Row 1: Flight with no distance — we estimate BOM↔LHR great-circle distance (~7200 km). Row 2: Hotel, 3 nights, no location. Row 3: Ground transport, no distance — flagged suspicious. Row 4: Flight with distance in miles — converted to km.

We omitted cabin class from sample data because it's absent in most real exports, and using a single emission factor for all flights is the industry standard when cabin data is unavailable.

### What would break in real deployment
1. **Cabin class missing**: Business class is ~3× economy for emissions. For executives with heavy travel, this is a material undercount. Without cabin class data, all flights use the same IATA average factor.
2. **Airport code lookup**: We hardcode a handful of IATA pairs for distance estimation. A real deployment needs a full IATA geodistance database (~10,000 airports).
3. **Hotel without location**: Hotel emission factors vary by country (energy mix, star rating). Without location, we can only apply a global average — imprecise.
4. **Rideshare vs. rail vs. rental car**: All mapped to "ground transport" with a single km-based factor. In reality, a train journey has ~10× lower emissions per km than a rental car. Concur often doesn't distinguish these clearly.
