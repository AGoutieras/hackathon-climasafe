#!/usr/bin/env python3
"""
Test script for OpenData Paris integration.
Validates that cool spots from both APIs are properly loaded and merged.
"""

from app.cities import load_cool_spots, get_city_config, haversine_km
import sys
sys.path.insert(0, './backend')


def main():
    print("=" * 70)
    print("ClimaSafe OpenData Paris Integration Test")
    print("=" * 70)

    # Test 1: Load cool spots
    print("\n[1] Loading cool spots from OpenData...")
    try:
        spots = load_cool_spots("paris")
        print(f"    ✓ Loaded {len(spots)} cool spots")
    except Exception as e:
        print(f"    ✗ Failed to load: {e}")
        return 1

    # Test 2: Breakdown by source
    print("\n[2] Breakdown by source:")
    green = sum(1 for s in spots if s.get('sourceClass') == 'green_space')
    amenity = sum(1 for s in spots if s.get('sourceClass') == 'amenity')
    print(f"    - Green spaces (espaces verts): {green}")
    print(f"    - Amenities (équipements): {amenity}")

    # Test 3: Validate structure
    print("\n[3] Validating data structure...")
    required_fields = ['id', 'name', 'lat', 'lng',
                       'coolnessScore', 'type', 'sourceClass']
    issues = []
    for i, spot in enumerate(spots):
        missing = [f for f in required_fields if f not in spot]
        if missing:
            issues.append(f"Spot {i} missing: {missing}")

    if issues:
        print(f"    ✗ Found {len(issues)} structural issues:")
        for issue in issues[:5]:
            print(f"      - {issue}")
        return 1
    else:
        print(f"    ✓ All {len(spots)} records have required fields")

    # Test 4: Validate coordinates
    print("\n[4] Validating coordinates...")
    coord_issues = 0
    out_of_range = []
    for i, spot in enumerate(spots):
        lat, lng = spot['lat'], spot['lng']
        # Paris bounding box (approximately) with small margin for suburbs
        if not (48.75 <= lat <= 48.95 and 2.15 <= lng <= 2.55):
            coord_issues += 1
            out_of_range.append(f"{spot['name']} ({lat}, {lng})")

    if coord_issues > 5:
        print(f"    ✗ {coord_issues} spots have out-of-bounds coordinates")
        for spot_info in out_of_range[:3]:
            print(f"      - {spot_info}")
        return 1
    elif coord_issues > 0:
        print(f"    ⚠ {coord_issues} spots in suburbs (acceptable)")
    else:
        print(f"    ✓ All coordinates are within/near Paris")

    # Test 5: Score distribution
    print("\n[5] Cool spot score distribution:")
    scores = [s.get('coolnessScore', 0) for s in spots]
    print(
        f"    - Min: {min(scores)}, Max: {max(scores)}, Avg: {sum(scores)//len(scores)}")
    print(f"    - Score < 70: {sum(1 for s in scores if s < 70)}")
    print(f"    - Score 70-80: {sum(1 for s in scores if 70 <= s < 80)}")
    print(f"    - Score 80-90: {sum(1 for s in scores if 80 <= s < 90)}")
    print(f"    - Score >= 90: {sum(1 for s in scores if s >= 90)}")

    # Test 6: Type distribution
    print("\n[6] Type distribution:")
    types = {}
    for spot in spots:
        t = spot.get('type', 'unknown')
        types[t] = types.get(t, 0) + 1

    for t, count in sorted(types.items(), key=lambda x: -x[1])[:8]:
        print(f"    - {t}: {count}")

    # Test 7: Specific locations
    print("\n[7] Testing with specific Paris locations:")
    test_locations = [
        ("Île de la Cité", 48.8530, 2.3499),
        ("Tour Eiffel", 48.8584, 2.2945),
        ("Montmartre", 48.8867, 2.3431),
    ]

    city = get_city_config("paris")
    for name, lat, lng in test_locations:
        nearby = sorted(
            [(s, haversine_km(s['lat'], s['lng'], lat, lng)) for s in spots],
            key=lambda x: x[1]
        )[:1]
        if nearby:
            spot, dist = nearby[0]
            print(
                f"    - {name:20} → {spot['name'][:30]:30} ({dist:.2f}km away)")

    print("\n" + "=" * 70)
    print("✓ All tests passed! OpenData integration is working correctly.")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
