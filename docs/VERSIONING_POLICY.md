# PinPoint India API Versioning Policy

## Overview

PinPoint India uses **URI-based versioning** to ensure API stability and backward compatibility for all clients. This document outlines our versioning strategy, deprecation policy, and guidelines for maintaining multiple API versions.

---

## Versioning Strategy

### URI Versioning

All API endpoints include a version identifier in the URI path:

```
https://api.pinpoint.in/api/v1/pincodes/110001
                           ^^^^
                         Version
```

**Current Version**: `v1` (Stable)

**Format**: `/api/v{major_version}/{resource}`

---

## Version Lifecycle

### Version States

1. **Development** - Work in progress, not publicly available
2. **Beta** - Available for testing, may have breaking changes
3. **Stable** - Production-ready, fully supported
4. **Deprecated** - Still functional but scheduled for removal
5. **Sunset** - No longer available

### Current API Versions

| Version | State | Release Date | Deprecation Date | Sunset Date | Support Level |
|---------|-------|--------------|------------------|-------------|---------------|
| **v1** | **Stable** | 2024-06-01 | TBD | TBD | **Full Support** |

---

## Breaking vs Non-Breaking Changes

### Breaking Changes (Require New Major Version)

Breaking changes **require a new API version** (e.g., v1 → v2):

- ❌ Removing endpoints
- ❌ Removing fields from responses
- ❌ Renaming fields in requests or responses
- ❌ Changing field data types (e.g., `string` → `number`)
- ❌ Changing authentication mechanisms
- ❌ Changing error response structure
- ❌ Making optional parameters required
- ❌ Changing HTTP status codes for existing scenarios
- ❌ Changing rate limiting behavior significantly

**Example (Breaking)**:
```json
// v1 Response
{
  "pincode": "110001",
  "officeName": "New Delhi GPO"  // ❌ Renaming this breaks clients
}

// v2 Response (Breaking Change)
{
  "pincode": "110001",
  "office": "New Delhi GPO"  // New field name
}
```

### Non-Breaking Changes (Can Add to Current Version)

Non-breaking changes can be added to the **current version** without disruption:

- ✅ Adding new endpoints
- ✅ Adding new optional query parameters
- ✅ Adding new fields to responses (clients ignore unknown fields)
- ✅ Adding new optional fields to requests
- ✅ Bug fixes that don't change API behavior
- ✅ Performance improvements
- ✅ Internal refactoring
- ✅ More permissive validation (relaxing constraints)

**Example (Non-Breaking)**:
```json
// v1 Response (Before)
{
  "pincode": "110001",
  "officeName": "New Delhi GPO"
}

// v1 Response (After - Added Field)
{
  "pincode": "110001",
  "officeName": "New Delhi GPO",
  "postalZone": "Delhi Central"  // ✅ New field, old clients ignore it
}
```

---

## Deprecation Policy

### Timeline

When a new major version is released, the previous version follows this timeline:

1. **Announcement** (T+0): New version released, old version marked as deprecated
2. **Grace Period** (6-12 months): Both versions run in parallel
3. **Sunset Warning** (T+6 months): Deprecation headers added to responses
4. **Sunset** (T+12 months): Old version removed

### Deprecation Headers

Deprecated API versions include the following HTTP headers:

```http
X-API-Version: v1
X-API-Deprecated: true
X-API-Deprecation-Date: 2026-01-01
X-API-Sunset-Date: 2027-01-01
X-API-Migration-Guide: https://docs.pinpoint.in/migration/v1-to-v2
```

### Deprecation Response Body

Deprecated versions may also include a `meta` section in responses:

```json
{
  "data": { ... },
  "meta": {
    "version": "v1",
    "deprecated": true,
    "deprecationDate": "2026-01-01",
    "sunsetDate": "2027-01-01",
    "migrationGuide": "https://docs.pinpoint.in/migration/v1-to-v2",
    "message": "This API version will be sunset on 2027-01-01. Please migrate to v2."
  }
}
```

---

## Support Levels

### Full Support (Current: v1)

- ✅ New features may be added
- ✅ Bug fixes and security patches
- ✅ Performance optimizations
- ✅ Documentation updates
- ✅ 24/7 monitoring and support

### Deprecated (Future)

- ⚠️ No new features
- ✅ Critical bug fixes only
- ✅ Security patches
- ⚠️ Limited support
- ⚠️ Sunset date announced

### Sunset

- ❌ Endpoints return 410 Gone
- ❌ No support
- ✅ Migration guide available

---

## Version Headers

All API responses include version metadata in headers:

```http
X-API-Version: v1
X-API-Stability: stable
X-API-Deprecated: false
X-RateLimit-Tier: pro
```

---

## Migration Strategy

### When We Release v2 (Future)

1. **Parallel Deployment**
   - Both v1 and v2 run simultaneously
   - Same infrastructure, shared database
   - Independent codebases for each version

2. **Migration Support**
   - Detailed migration guide published
   - Side-by-side API comparison table
   - Code examples for common use cases
   - Migration support via email/chat

3. **Testing Period**
   - Beta access to v2 before deprecating v1
   - 6-month grace period minimum
   - Gradual rollout with monitoring

---

## Semantic Versioning (Internal)

While the public API uses major versions (`v1`, `v2`), we use semantic versioning internally:

```
Version: 1.2.3
         │ │ └─ Patch: Bug fixes, no API changes
         │ └─── Minor: New features, non-breaking
         └───── Major: Breaking changes → new API version
```

**Examples**:
- `1.0.0` → Initial v1 release
- `1.1.0` → Added new endpoint (non-breaking)
- `1.1.1` → Bug fix (no API change)
- `2.0.0` → Breaking changes → release as v2

---

## Client Best Practices

### For API Consumers

1. **Always specify version** in the URL (don't rely on defaults)
2. **Ignore unknown fields** in responses (forward compatibility)
3. **Monitor deprecation headers** in production
4. **Subscribe to updates** for deprecation notices
5. **Test against beta versions** before they go stable

### Response Parsing

```javascript
// ✅ Good: Ignore unknown fields
const { pincode, officeName } = response.data;

// ❌ Bad: Strict schema validation breaks on new fields
const data = strictValidate(response.data);  // Fails when we add fields
```

---

## Questions?

For questions about API versioning:
- 📧 Email: api-support@pinpoint.in
- 📚 Docs: https://docs.pinpoint.in/versioning
- 💬 GitHub: https://github.com/pinpoint-india/api/discussions

---

**Last Updated**: 2024-06-15  
**Policy Version**: 1.0
