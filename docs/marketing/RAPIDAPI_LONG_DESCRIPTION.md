# PinPoint India - High-Performance Dual Addressing API for India

**India's most comprehensive addressing API** supporting both **traditional PINCODE** (6-digit postal codes) and **modern DIGIPIN** (India Post's official geocoding system) with production-grade performance and accuracy.

## 🎯 Key Features

### Data Coverage
- **19,000+ Pincodes** with precise geographic boundaries
- **150,000+ Post Offices** with GPS coordinates
- **28 States + 8 Union Territories** with complete administrative hierarchy
- **700+ Districts** with regional subdivisions
- **Official India Post data** - authoritative and accurate

### Core Capabilities
- **Polygon-Based Location Verification** - Know exactly which pincode contains any coordinate
- **DIGIPIN Integration** - India Post's official 10-level grid-based geocoding system
- **Dual Conversion** - Seamless PINCODE ↔ DIGIPIN ↔ Coordinates conversion
- **Spatial Queries** - Polygon-aware reverse geocoding, nearby searches, boundary validation
- **Distance Calculator** - Calculate distances between any two locations
- **Bulk Operations** - Batch processing for high-volume applications

## 🛤️ API Endpoints

### **PINCODE Operations**
- Lookup pincode details with administrative hierarchy
- **Polygon-aware reverse geocoding** - coordinates to pincode using actual boundaries
- **Point-in-polygon validation** - check if coordinates fall within pincode area
- Search and filter by state, district, region, or name
- Find nearby pincodes within specified radius
- Bulk lookups for batch processing (up to 100 pincodes)
- Validate pincode format and existence

### **Administrative Data**
- Browse all Indian states and union territories
- Get detailed state information with metadata
- List all districts with hierarchical relationships
- Access regional administrative divisions
- Complete hierarchy traversal (State → Division → District → Sub-District → Taluka)

### **DIGIPIN Operations** *(India Post's Official Geocoding)*
- Encode coordinates to DIGIPIN codes (10 precision levels)
- Decode DIGIPIN to coordinates (centroid + boundary)
- Validate DIGIPIN format and geographic bounds
- **Convert DIGIPIN ↔ PINCODE** bidirectionally
- Get cell hierarchy (parent, children, ancestors, descendants)
- Find neighboring cells in the 4×4 grid system
- Spatial proximity and containment queries

### **Distance Operations**
- Calculate distance between any two locations
- Support for **PINCODE-to-PINCODE** distance
- Support for **DIGIPIN-to-DIGIPIN** distance
- Support for **coordinate-to-coordinate** distance
- **Mixed-type calculations** (PINCODE ↔ DIGIPIN ↔ Coordinates)
- Batch distance calculations for route optimization

## 🚀 Use Cases

### E-Commerce & Logistics
- **Address validation** with polygon-based accuracy (not just nearest match)
- **Delivery zone verification** - know exactly which pincodes you service
- **Serviceability checks** - instant boundary-aware coverage validation
- **Distance calculations** for shipping costs and ETA estimates
- **Route optimization** with batch distance APIs

### Real Estate & PropTech
- **Property location verification** using polygon containment
- **Accurate pincode assignment** for new listings
- **Boundary-aware search** - find properties within specific areas
- **Service area mapping** for real estate agents
- **Location intelligence** with dual addressing (PINCODE + DIGIPIN)

### Delivery & Hyperlocal
- **Precise serviceability** checks using actual pincode boundaries
- **DIGIPIN-based micro-zones** for last-mile optimization
- **Dynamic delivery zones** with grid-based addressing
- **Coverage mapping** for operational planning

### Government & Analytics
- **Administrative hierarchy** for census and surveys
- **Spatial analysis** with accurate boundary data
- **Demographic insights** by region, district, or pincode
- **Data enrichment** for location-based datasets

### Maps & Navigation
- **Reverse geocoding** with polygon accuracy
- **Dual address display** (PINCODE + DIGIPIN)
- **Boundary visualization** for maps and dashboards
- **Location validation** for user input

## 🔐 Authentication & Rate Limits

API uses **flexible authentication** with dual header support:
- `X-API-Key: your_api_key` (recommended)
- `Authorization: Bearer your_api_key` (OAuth-style)

### Rate Limits by Tier
Designed to handle traffic bursts while preventing abuse:

- **FREE**: 10 requests/minute (~600/hour)
- **BASIC**: 100 requests/minute (~6,000/hour)
- **PRO**: 500 requests/minute (~30,000/hour)
- **ULTRA**: 1,000 requests/minute (~60,000/hour)
- **ENTERPRISE**: Unlimited (custom contracts)

**Response Headers**:
- `X-RateLimit-Limit` - Your request quota
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Timestamp when quota resets

## 📊 What is DIGIPIN?

**DIGIPIN (Digital Postal Index Number)** is India Post's official geocoding system:
- **10-character alphanumeric codes** (e.g., `C4P8K63M4M`)
- **Hierarchical 4×4 grid system** with 10 precision levels
- **~4m × 4m accuracy** at the highest level (Level 10)
- **Covers all of India** including remote and maritime regions
- **Officially standardized** by Department of Posts, Government of India

DIGIPIN provides a modern, precise alternative to traditional 6-digit pincodes, enabling micro-level location addressing for last-mile delivery, emergency services, and smart city applications.

## 🌟 Why Choose PinPoint India?

✅ **Dual addressing system** - PINCODE + DIGIPIN in one API  
✅ **Polygon-accurate** - real boundaries, not approximations  
✅ **Production-grade performance** - 100+ req/sec, sub-2ms latency  
✅ **Smart rate limiting** - handles traffic bursts gracefully  
✅ **Complete data** - 19,000+ pincodes, 150,000+ post offices  
✅ **Spatial accuracy** - boundary-based location validation  
✅ **Developer-friendly** - comprehensive docs, bulk operations, clear error handling  
✅ **Battle-tested** - proven under high-concurrency production loads  
✅ **Official data sources** - India Post + Government of India spatial data

## 📖 Documentation

- **Interactive API docs**: `https://pynpoint.codesense.in/api/docs`
- **OpenAPI 3.0 spec**: Available via `/api/docs-json`
- **Code examples**: JavaScript, Python, cURL included
- **Postman collection**: Available on request

## 🎯 Perfect For

- **E-commerce platforms** requiring accurate address validation
- **Logistics companies** needing delivery zone mapping
- **Real estate portals** with location-based search
- **Hyperlocal delivery** services using DIGIPIN micro-zones
- **Government applications** requiring administrative hierarchy
- **Analytics platforms** processing location data
- **Mapping applications** with dual addressing support
- **FinTech apps** needing location-based KYC verification

---

**Built for India. Optimized for scale. Ready for production.** 🚀
