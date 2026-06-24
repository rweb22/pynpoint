#!/usr/bin/env python3
"""
Interactive query tool for official pincode JSON data
Usage: python3 query-official-data.py
"""

import json
from collections import Counter, defaultdict
import sys

# Load data
print("Loading official pincode data...")
with open('data-downloads/official-pincode-data.json', 'r') as f:
    data = json.load(f)

print(f"Loaded {len(data):,} records\n")

def query_states():
    """List all unique states"""
    states = Counter(r['statename'] for r in data)
    print(f"\n=== ALL STATES ({len(states)} total) ===")
    for state, count in sorted(states.items()):
        print(f"{state:50} : {count:,} postoffices")
    return states

def query_state_details(state_name):
    """Get details for a specific state"""
    # Case-insensitive search
    records = [r for r in data if state_name.upper() in r['statename'].upper()]
    
    if not records:
        print(f"\n❌ No records found for state matching: {state_name}")
        return
    
    print(f"\n=== {records[0]['statename']} ===")
    print(f"Total postoffices: {len(records):,}")
    
    # Unique pincodes
    pincodes = set(r['pincode'] for r in records)
    print(f"Unique pincodes: {len(pincodes):,}")
    
    # Districts
    districts = Counter(r['district'] for r in records)
    print(f"Unique districts: {len(districts)}")
    
    # Office types
    office_types = Counter(r['officetype'] for r in records)
    print(f"\nOffice types:")
    for otype, count in office_types.most_common():
        print(f"  {otype}: {count:,}")
    
    # GPS coverage
    with_gps = sum(1 for r in records if r['latitude'] not in ['NA', '', None])
    print(f"\nGPS coverage: {with_gps:,} / {len(records):,} ({with_gps/len(records)*100:.1f}%)")
    
    # Sample records
    print(f"\nSample postoffices:")
    for r in records[:5]:
        print(f"  - {r['officename']} (PIN {r['pincode']}, {r['district']})")
    
    # Top districts
    print(f"\nTop 5 districts by postoffice count:")
    for district, count in districts.most_common(5):
        print(f"  {district:40} : {count:,}")
    
    return records

def query_pincode(pincode):
    """Get all postoffices for a pincode"""
    records = [r for r in data if r['pincode'] == str(pincode)]
    
    if not records:
        print(f"\n❌ No records found for pincode: {pincode}")
        return
    
    print(f"\n=== PINCODE {pincode} ===")
    print(f"Total postoffices: {len(records)}")
    print(f"State: {records[0]['statename']}")
    print(f"District: {records[0]['district']}")
    
    print(f"\nPostoffices:")
    for r in records:
        gps = f"({r['latitude']}, {r['longitude']})" if r['latitude'] != 'NA' else "(No GPS)"
        print(f"  - {r['officename']:40} {r['officetype']:3} {gps}")
    
    return records

def query_anomalies():
    """Find potential data anomalies"""
    print("\n=== ANOMALY DETECTION ===\n")
    
    # 1. NA states
    na_states = [r for r in data if r['statename'] == 'NA']
    print(f"1. Records with statename='NA': {len(na_states):,}")
    if na_states:
        districts = Counter(r['district'] for r in na_states)
        print(f"   Districts affected:")
        for district, count in districts.most_common(10):
            print(f"     - {district}: {count:,}")
    
    # 2. Missing GPS
    no_gps = [r for r in data if r['latitude'] in ['NA', '', None]]
    print(f"\n2. Records missing GPS: {len(no_gps):,} ({len(no_gps)/len(data)*100:.1f}%)")
    states_no_gps = Counter(r['statename'] for r in no_gps)
    print(f"   Top 5 states with missing GPS:")
    for state, count in states_no_gps.most_common(5):
        print(f"     - {state}: {count:,}")
    
    # 3. Pincodes spanning multiple states
    pincode_states = defaultdict(set)
    for r in data:
        pincode_states[r['pincode']].add(r['statename'])
    
    multi_state = {pin: states for pin, states in pincode_states.items() if len(states) > 1}
    print(f"\n3. Pincodes spanning multiple states: {len(multi_state):,}")
    print(f"   Sample (first 10):")
    for i, (pin, states) in enumerate(list(multi_state.items())[:10], 1):
        print(f"     {i}. PIN {pin}: {', '.join(sorted(states))}")
    
    # 4. Check for empty/null fields
    print(f"\n4. Empty field check:")
    for field in ['officename', 'district', 'pincode', 'statename']:
        empty = sum(1 for r in data if not r.get(field) or r[field] in ['', 'NA', None])
        if empty > 0:
            print(f"   ⚠️  {field}: {empty:,} empty/NA values")
    
    # 5. Unusual office names
    print(f"\n5. Office name patterns:")
    with_bo = sum(1 for r in data if 'B.O' in r['officename'] or 'BO' in r['officename'])
    with_so = sum(1 for r in data if 'S.O' in r['officename'] or 'SO' in r['officename'])
    with_ho = sum(1 for r in data if 'H.O' in r['officename'] or 'HO' in r['officename'])
    print(f"   Officenames containing 'B.O'/'BO': {with_bo:,}")
    print(f"   Officenames containing 'S.O'/'SO': {with_so:,}")
    print(f"   Officenames containing 'H.O'/'HO': {with_ho:,}")

def query_office_type_analysis():
    """Analyze office type field vs office name"""
    print("\n=== OFFICE TYPE ANALYSIS ===\n")
    
    office_types = Counter(r['officetype'] for r in data)
    print("Office type field distribution:")
    for otype, count in office_types.most_common():
        print(f"  {otype}: {count:,} ({count/len(data)*100:.1f}%)")
    
    # Check consistency between officetype and officename
    print("\nConsistency check (officetype vs officename suffix):")
    
    # BO type
    bo_records = [r for r in data if r['officetype'] == 'BO']
    bo_with_suffix = sum(1 for r in bo_records if r['officename'].endswith('B.O'))
    print(f"  BO records: {len(bo_records):,}")
    print(f"    - With 'B.O' suffix: {bo_with_suffix:,} ({bo_with_suffix/len(bo_records)*100:.1f}%)")
    
    # PO type  
    po_records = [r for r in data if r['officetype'] == 'PO']
    po_with_so = sum(1 for r in po_records if 'S.O' in r['officename'] or r['officename'].endswith('SO'))
    print(f"  PO records: {len(po_records):,}")
    print(f"    - With 'S.O'/'SO' in name: {po_with_so:,} ({po_with_so/len(po_records)*100:.1f}%)")
    
    # Sample PO records
    print(f"\n  Sample PO records:")
    for r in po_records[:5]:
        print(f"    - {r['officename']} (PIN {r['pincode']})")

# Main interactive menu
def main():
    while True:
        print("\n" + "="*60)
        print("OFFICIAL PINCODE DATA QUERY TOOL")
        print("="*60)
        print("1. List all states")
        print("2. Query specific state")
        print("3. Query specific pincode")
        print("4. Detect anomalies")
        print("5. Office type analysis")
        print("6. Exit")
        print()
        
        choice = input("Enter choice (1-6): ").strip()
        
        if choice == '1':
            query_states()
        elif choice == '2':
            state = input("Enter state name (partial match OK): ").strip()
            query_state_details(state)
        elif choice == '3':
            pincode = input("Enter pincode: ").strip()
            query_pincode(pincode)
        elif choice == '4':
            query_anomalies()
        elif choice == '5':
            query_office_type_analysis()
        elif choice == '6':
            print("\nGoodbye!")
            break
        else:
            print("Invalid choice. Try again.")

if __name__ == '__main__':
    main()
