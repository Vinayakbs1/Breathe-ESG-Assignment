import csv
import io
from datetime import datetime
from .models import EmissionRecord

# ─── UNIT CONVERSION HELPERS ───────────────────────────────────────────────

def normalize_fuel_to_liters(value, unit):
    """
    SAP sends fuel in L, LTR, GAL (gallons), KG (for LPG/oil).
    We normalize everything to liters.
    KG is tricky — we use approximate density for fuel oil.
    """
    unit = unit.strip().upper()
    conversions = {
        'L':       1.0,
        'LTR':     1.0,
        'LITRE':   1.0,
        'LITER':   1.0,
        'LITERS':  1.0,
        'LITRES':  1.0,
        'GAL':     3.78541,   # US gallon to liters
        'GALLON':  3.78541,
        'GALLONS': 3.78541,
        'KG':      1.1,       # approximate: 1 kg fuel oil ≈ 1.1 liters
        'KGS':     1.1,
    }
    if unit not in conversions:
        raise ValueError(f"Unknown fuel unit: {unit}")
    return round(value * conversions[unit], 4)


def normalize_energy_to_kwh(value, unit):
    """
    Utility data comes in kWh or MWh.
    We always store in kWh.
    """
    unit = unit.strip().upper()
    conversions = {
        'KWH':  1.0,
        'MWH':  1000.0,   # 1 MWh = 1000 kWh
        'WH':   0.001,
    }
    if unit not in conversions:
        raise ValueError(f"Unknown energy unit: {unit}")
    return round(value * conversions[unit], 4)


def normalize_distance_to_km(value, unit):
    """
    Travel distances can be in km or miles.
    We always store in km.
    """
    unit = unit.strip().upper() if unit else 'KM'
    conversions = {
        'KM':    1.0,
        'KMS':   1.0,
        'MILES': 1.60934,
        'MILE':  1.60934,
        'MI':    1.60934,
    }
    if unit not in conversions:
        raise ValueError(f"Unknown distance unit: {unit}")
    return round(value * conversions[unit], 4)


def parse_date(date_str):
    """
    SAP exports dates in multiple formats depending on user locale.
    We try all known formats.
    """
    if not date_str or not date_str.strip():
        return None

    date_str = date_str.strip()
    formats = [
        '%d.%m.%Y',    # 15.01.2024  (German/European format)
        '%Y-%m-%d',    # 2024-01-22  (ISO format)
        '%b %d %Y',    # Jan 30 2024
        '%d/%m/%Y',    # 01/02/2024
        '%m/%d/%Y',    # 01/30/2024 (US format)
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date().isoformat()
        except ValueError:
            continue
    return date_str  # return as-is if nothing matched


# ─── FLAG / SUSPICIOUS DETECTION ────────────────────────────────────────────

def check_suspicious(value, unit, source_type, all_values=None):
    """
    Returns (is_suspicious: bool, reason: str)
    Checks:
    - Negative values (physically impossible)
    - Extreme spikes (value > 10x the average of other records)
    """
    reasons = []

    if value < 0:
        reasons.append(f"Negative value: {value} {unit}")

    if all_values and len(all_values) > 3:
        avg = sum(all_values) / len(all_values)
        if avg > 0 and value > avg * 10:
            reasons.append(f"Abnormal spike: {value} is more than 10x the average ({avg:.1f})")

    return len(reasons) > 0, '; '.join(reasons)


# ─── SAP PARSER ─────────────────────────────────────────────────────────────

# SAP column headers are in German. This maps German → our field names.
SAP_COLUMN_MAP = {
    'Werk':          'plant_code',
    'Material':      'material',
    'Bewegungsart':  'movement_type',
    'Menge':         'quantity',
    'Einheit':       'unit',
    'Buchungsdatum': 'date',
    'Lieferant':     'vendor',
    'Materialgruppe':'material_group',
    'Belegart':      'doc_type',
    'Kostenstelle':  'cost_center',
}


def parse_sap_csv(file_content, batch, tenant):
    """
    Parses the SAP flat file export.
    Returns: (successful_records, failed_rows_count, failed_details)
    """
    reader = csv.DictReader(io.StringIO(file_content))
    records = []
    failed = 0
    failed_details = []

    # Collect all values first so we can detect spikes
    raw_quantities = []

    rows = list(reader)  # read all rows into memory first

    # First pass: collect all quantities for spike detection
    for row in rows:
        try:
            qty = float(row.get('Menge', 0))
            if qty > 0:
                raw_quantities.append(qty)
        except (ValueError, TypeError):
            pass

    # Second pass: parse and save
    for i, row in enumerate(rows):
        try:
            # Map German headers to our names
            mapped = {}
            for german, english in SAP_COLUMN_MAP.items():
                mapped[english] = row.get(german, '').strip()

            # Validate required fields
            if not mapped['plant_code']:
                raise ValueError("Missing plant code (Werk)")
            if not mapped['quantity']:
                raise ValueError("Missing quantity (Menge)")
            if not mapped['unit']:
                raise ValueError("Missing unit (Einheit)")

            raw_qty = float(mapped['quantity'])
            raw_unit = mapped['unit']

            # Normalize fuel to liters
            normalized_qty = normalize_fuel_to_liters(raw_qty, raw_unit)

            # Check suspicious
            is_suspicious, flag_reason = check_suspicious(
                raw_qty, raw_unit, 'sap', raw_quantities
            )

            # Determine category from material group
            mat_group = mapped.get('material_group', '').upper()
            if 'GAS' in mat_group:
                category = 'fuel'  # LPG is still fuel/Scope 1
            elif 'HFO' in mat_group:
                category = 'fuel'
            else:
                category = 'fuel'  # all SAP fuel records = Scope 1 fuel

            record = EmissionRecord(
                tenant=tenant,
                batch=batch,
                scope='scope1',
                category=category,
                raw_value=raw_qty,
                raw_unit=raw_unit,
                normalized_value=normalized_qty,
                normalized_unit='liters',
                metadata={
                    'plant_code':    mapped['plant_code'],
                    'material':      mapped['material'],
                    'vendor':        mapped['vendor'],
                    'cost_center':   mapped['cost_center'],
                    'purchase_date': parse_date(mapped['date']),
                    'movement_type': mapped['movement_type'],
                },
                status='suspicious' if is_suspicious else 'pending',
                flag_reason=flag_reason,
            )
            records.append(record)

        except Exception as e:
            failed += 1
            failed_details.append(f"Row {i+2}: {str(e)}")

    # Bulk create — much faster than creating one by one
    EmissionRecord.objects.bulk_create(records)
    return len(records), failed, failed_details


# ─── UTILITY PARSER ──────────────────────────────────────────────────────────

def parse_utility_csv(file_content, batch, tenant):
    """
    Parses electricity utility portal CSV export.
    Handles: kWh/MWh units, billing periods, duplicate detection.
    """
    reader = csv.DictReader(io.StringIO(file_content))
    records = []
    failed = 0
    failed_details = []

    # Track meter+period combinations to detect duplicates
    seen_meter_periods = set()

    rows = list(reader)

    # Collect all quantities for spike detection
    raw_quantities = []
    for row in rows:
        try:
            qty = float(row.get('Units_Consumed', 0))
            if qty > 0:
                raw_quantities.append(qty)
        except (ValueError, TypeError):
            pass

    for i, row in enumerate(rows):
        try:
            meter_id = row.get('Meter_ID', '').strip()
            billing_start = row.get('Billing_Period_Start', '').strip()
            billing_end = row.get('Billing_Period_End', '').strip()
            units_str = row.get('Units_Consumed', '').strip()
            uom = row.get('UOM', 'kWh').strip()
            tariff = row.get('Tariff_Category', '').strip()
            facility = row.get('Facility_Name', '').strip()

            # Validate required
            if not meter_id:
                raise ValueError("Missing Meter_ID")
            if not units_str:
                raise ValueError("Missing Units_Consumed")
            if not billing_end:
                raise ValueError("Missing Billing_Period_End")

            raw_qty = float(units_str)

            # Duplicate detection: same meter + same billing end = duplicate bill
            dedup_key = f"{meter_id}_{billing_end}"
            is_duplicate = dedup_key in seen_meter_periods
            seen_meter_periods.add(dedup_key)

            # Normalize to kWh
            normalized_qty = normalize_energy_to_kwh(raw_qty, uom)

            # Check suspicious
            is_suspicious, flag_reason = check_suspicious(
                raw_qty, uom, 'utility', raw_quantities
            )

            # Add duplicate flag to reason
            if is_duplicate:
                flag_reason = ('Duplicate meter+billing period detected. ' + flag_reason).strip()
                is_suspicious = True

            # Zero consumption is suspicious (could be a missed reading)
            if raw_qty == 0:
                flag_reason = (flag_reason + ' Zero consumption recorded.').strip()
                is_suspicious = True

            # Missing billing start is worth flagging
            if not billing_start:
                flag_reason = (flag_reason + ' Missing billing period start date.').strip()
                is_suspicious = True

            record = EmissionRecord(
                tenant=tenant,
                batch=batch,
                scope='scope2',
                category='electricity',
                raw_value=raw_qty,
                raw_unit=uom,
                normalized_value=normalized_qty,
                normalized_unit='kWh',
                metadata={
                    'meter_id':       meter_id,
                    'facility':       facility,
                    'billing_start':  billing_start,
                    'billing_end':    billing_end,
                    'tariff':         tariff,
                    'account_number': row.get('Account_Number', ''),
                    'payment_status': row.get('Payment_Status', ''),
                },
                status='suspicious' if is_suspicious else 'pending',
                flag_reason=flag_reason,
            )
            records.append(record)

        except Exception as e:
            failed += 1
            failed_details.append(f"Row {i+2}: {str(e)}")

    EmissionRecord.objects.bulk_create(records)
    return len(records), failed, failed_details


# ─── TRAVEL PARSER ───────────────────────────────────────────────────────────

# Airport code pairs → approximate flight distances in km
# This is why we need this lookup: Concur often gives codes only, not distances
AIRPORT_DISTANCES = {
    frozenset(['BLR', 'DEL']): 1740,
    frozenset(['BOM', 'HYD']): 711,
    frozenset(['DEL', 'SIN']): 4150,
    frozenset(['BLR', 'CCU']): 1871,
    frozenset(['BLR', 'LHR']): 8380,
    frozenset(['HYD', 'BOM']): 711,
    frozenset(['BOM', 'DEL']): 1148,
    frozenset(['BLR', 'DXB']): 2836,
    frozenset(['BLR', 'BOM']): 842,
    frozenset(['BLR', 'JFK']): 13786,
    frozenset(['DEL', 'PNQ']): 1397,
    frozenset(['BOM', 'SFO']): 13982,
    frozenset(['BLR', 'MAA']): 285,
}

TRAVEL_CATEGORY_MAP = {
    'flight':           ('scope3', 'flight'),
    'hotel':            ('scope3', 'hotel'),
    'ground_transport': ('scope3', 'ground_transport'),
    'car':              ('scope3', 'ground_transport'),
    'taxi':             ('scope3', 'ground_transport'),
    'train':            ('scope3', 'ground_transport'),
}


def parse_travel_csv(file_content, batch, tenant):
    """
    Parses Concur-style corporate travel CSV.
    Handles: missing distances (uses airport lookup), mixed categories.
    """
    reader = csv.DictReader(io.StringIO(file_content))
    records = []
    failed = 0
    failed_details = []

    rows = list(reader)

    for i, row in enumerate(rows):
        try:
            travel_type = row.get('Travel_Type', '').strip().lower()
            origin = row.get('Origin', '').strip().upper()
            destination = row.get('Destination', '').strip().upper()
            employee = row.get('Employee_Name', '').strip()
            employee_id = row.get('Employee_ID', '').strip()
            dept = row.get('Department', '').strip()
            distance_str = row.get('Distance_KM', '').strip()
            hotel_nights_str = row.get('Hotel_Nights', '0').strip()
            travel_date = row.get('Travel_Date', '').strip()

            if not travel_type:
                raise ValueError("Missing Travel_Type")

            scope, category = TRAVEL_CATEGORY_MAP.get(
                travel_type, ('scope3', 'ground_transport')
            )

            reasons = []

            # ── FLIGHT: figure out distance ──────────────────────────────
            if category == 'flight':
                raw_value = 0
                raw_unit = 'km'
                distance_source = 'provided'

                if distance_str and distance_str not in ['', '0']:
                    try:
                        raw_value = float(distance_str)
                        if raw_value < 0:
                            reasons.append("Negative distance value")
                            raw_value = abs(raw_value)
                    except ValueError:
                        pass

                # If distance missing or zero, try airport code lookup
                if raw_value == 0 and origin and destination:
                    key = frozenset([origin, destination])
                    if key in AIRPORT_DISTANCES:
                        raw_value = AIRPORT_DISTANCES[key]
                        distance_source = f'estimated from airport codes {origin}→{destination}'
                        reasons.append(f"Distance estimated from airport codes (not provided)")
                    else:
                        reasons.append(f"Distance missing and airport pair {origin}→{destination} not in lookup table")

                normalized_value = raw_value
                normalized_unit = 'km'

                if not employee:
                    reasons.append("Missing employee name")

                metadata = {
                    'employee':        employee,
                    'employee_id':     employee_id,
                    'department':      dept,
                    'origin':          origin,
                    'destination':     destination,
                    'airline':         row.get('Airline_Vendor', ''),
                    'travel_class':    row.get('Class', ''),
                    'travel_date':     travel_date,
                    'distance_source': distance_source,
                }

            # ── HOTEL: nights as the "value" ────────────────────────────
            elif category == 'hotel':
                try:
                    raw_value = float(hotel_nights_str) if hotel_nights_str else 0
                except ValueError:
                    raw_value = 0

                raw_unit = 'nights'
                normalized_value = raw_value
                normalized_unit = 'nights'

                if raw_value == 0:
                    reasons.append("Zero hotel nights recorded")

                metadata = {
                    'employee':    employee,
                    'employee_id': employee_id,
                    'department':  dept,
                    'hotel_name':  row.get('Hotel_Name', ''),
                    'check_in':    travel_date,
                    'check_out':   row.get('Return_Date', ''),
                }

            # ── GROUND TRANSPORT ────────────────────────────────────────
            else:
                try:
                    raw_value = float(row.get('Ground_Distance_KM', 0) or 0)
                except ValueError:
                    raw_value = 0

                if raw_value < 0:
                    reasons.append("Negative ground distance")
                    raw_value = abs(raw_value)

                raw_unit = 'km'
                normalized_value = raw_value
                normalized_unit = 'km'

                if raw_value == 0:
                    reasons.append("Missing ground transport distance")

                if not employee:
                    reasons.append("Missing employee name")

                metadata = {
                    'employee':         employee,
                    'employee_id':      employee_id,
                    'department':       dept,
                    'transport_type':   row.get('Ground_Transport_Type', travel_type),
                    'origin':           row.get('Origin', ''),
                    'destination':      row.get('Destination', ''),
                    'travel_date':      travel_date,
                }

            is_suspicious = len(reasons) > 0
            flag_reason = '; '.join(reasons)

            record = EmissionRecord(
                tenant=tenant,
                batch=batch,
                scope=scope,
                category=category,
                raw_value=raw_value,
                raw_unit=raw_unit,
                normalized_value=normalized_value,
                normalized_unit=normalized_unit,
                metadata=metadata,
                status='suspicious' if is_suspicious else 'pending',
                flag_reason=flag_reason,
            )
            records.append(record)

        except Exception as e:
            failed += 1
            failed_details.append(f"Row {i+2}: {str(e)}")

    EmissionRecord.objects.bulk_create(records)
    return len(records), failed, failed_details