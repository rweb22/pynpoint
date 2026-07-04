#!/usr/bin/env python3
"""
Clean OpenAPI Spec - Remove Admin Endpoints

Removes internal admin endpoints from the OpenAPI specification
for public distribution (RapidAPI, AWS Marketplace, etc.)

Usage:
    python scripts/clean-openapi-admin.py openapi-spec.json openapi-spec-public.json
"""

import json
import sys
from pathlib import Path


def clean_openapi_spec(input_file: str, output_file: str):
    """Remove admin endpoints and internal schemas from OpenAPI spec."""
    
    # Load the OpenAPI spec
    with open(input_file, 'r') as f:
        spec = json.load(f)
    
    print(f"📖 Loaded OpenAPI spec from {input_file}")
    print(f"   Total endpoints: {len(spec.get('paths', {}))}")
    
    # Endpoints to remove (admin endpoints)
    admin_patterns = [
        '/api/v1/admin/',  # All admin endpoints
    ]
    
    # Tags to remove
    tags_to_remove = ['AdminApiKey']
    
    # Remove admin endpoints
    paths_to_remove = []
    for path in spec.get('paths', {}):
        for pattern in admin_patterns:
            if pattern in path:
                paths_to_remove.append(path)
                break
    
    for path in paths_to_remove:
        del spec['paths'][path]
        print(f"   ❌ Removed: {path}")
    
    # Remove admin tags from global tags list
    if 'tags' in spec:
        spec['tags'] = [tag for tag in spec['tags'] if tag.get('name') not in tags_to_remove]
    
    # Remove admin schemas from components
    schemas_to_remove = [
        'CreateApiKeyDto',
        'UpdateApiKeyTierDto',
    ]
    
    if 'components' in spec and 'schemas' in spec['components']:
        for schema in schemas_to_remove:
            if schema in spec['components']['schemas']:
                del spec['components']['schemas'][schema]
                print(f"   ❌ Removed schema: {schema}")
    
    # Save cleaned spec
    with open(output_file, 'w') as f:
        json.dump(spec, f, indent=2)
    
    print(f"\n✅ Cleaned OpenAPI spec saved to {output_file}")
    print(f"   Remaining endpoints: {len(spec.get('paths', {}))}")
    print(f"   Removed: {len(paths_to_remove)} admin endpoints")
    print(f"\n🎯 Ready for public distribution (RapidAPI, marketplaces)")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python scripts/clean-openapi-admin.py <input.json> <output.json>")
        print("Example: python scripts/clean-openapi-admin.py openapi-spec.json openapi-spec-public.json")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not Path(input_file).exists():
        print(f"❌ Error: Input file not found: {input_file}")
        sys.exit(1)
    
    clean_openapi_spec(input_file, output_file)
