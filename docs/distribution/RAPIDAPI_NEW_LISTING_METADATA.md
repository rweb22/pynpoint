# RapidAPI New Listing - Complete Metadata

**Date**: 2026-07-08  
**Purpose**: Create fresh RapidAPI listing after deleting previous one (to clear UUID errors)

---

## 📋 Basic Information

### API Name
```
PinPoint India - Pincode & Digipin Geocoding API
```

**OR shorter version:**
```
PinPoint India
```

*(Choose based on RapidAPI's character limit)*

---

### Category
```
Location & Maps
```

**OR**
```
Data & Analytics
```

---

### Tags (Keywords)
```
india, pincode, geocoding, digipin, postal-code, reverse-geocoding, location, gps, coordinates, address-validation, india-post, logistics, delivery, location-intelligence
```

---

## 📝 Short Description (1-2 sentences, ~100-150 characters)

```
India's most comprehensive addressing API with 19,000+ Pincodes and DIGIPIN support. Polygon-accurate geocoding, dual conversion, and distance calculations for production applications.
```

**Alternative (shorter):**
```
Comprehensive Indian PINCODE and DIGIPIN geocoding API. Polygon-accurate location validation, dual addressing, distance calculations, and bulk operations.
```

---

## 📖 Long Description (Full Marketing Copy)

*Use the complete content from `docs/marketing/RAPIDAPI_LONG_DESCRIPTION.md` (155 lines)*

**Includes**:
- Key Features (Data Coverage, Core Capabilities)
- API Endpoints overview
- Use Cases (E-Commerce, Real Estate, Delivery, Government, Maps)
- Authentication & Rate Limits
- What is DIGIPIN explanation
- Why Choose PinPoint India
- Documentation links
- Perfect For section

**Character Count**: ~6,500 characters

**File Location**: `pynpoint/docs/marketing/RAPIDAPI_LONG_DESCRIPTION.md`

---

## 📚 README / Documentation Tab

*Use the complete content from `docs/distribution/RAPIDAPI_README.md` (524 lines)*

**Includes**:
- Quick Start guide
- Authentication examples
- 6 Common Use Cases with curl examples
- Complete API Reference (all endpoints)
- Key Features & Data Coverage
- Rate Limits table
- Error Handling
- Best Practices
- Support & Resources
- Additional Examples

**File Location**: `pynpoint/docs/distribution/RAPIDAPI_README.md`

---

## 🔗 Base URL

```
https://pynpoint.codesense.in
```

---

## 📄 OpenAPI Specification

**File**: `pynpoint/openapi-spec-public.json`

**Upload Method**: File upload (JSON)

**Version**: OpenAPI 3.0.0

**Validation Status**: ✅ Fully validated, no errors

**Endpoints**: 36 public endpoints (admin endpoints excluded)

**Request Examples**: Removed from test endpoint `POST /pincodes/reverse-geocode` for UUID error debugging

---

## 🔐 Authentication Configuration

### Security Scheme
- **Type**: API Key
- **Header Name**: `X-API-Key`
- **Location**: Header
- **Description**: Your API key from subscription

**Note**: RapidAPI will automatically transform this to `X-RapidAPI-Key` for consumers

---

## 🌐 Server Configuration

### Production Server
- **URL**: `https://pynpoint.codesense.in`
- **Description**: Production server

### Development Server (Optional)
- **URL**: `http://localhost:3000`
- **Description**: Local development

---

## 💰 Pricing Tiers (Suggested)

### FREE
- **Price**: $0/month
- **Quota**: 10 requests/minute (~600/hour)
- **Includes**: All endpoints, rate limit headers
- **Best For**: Testing & development

### BASIC
- **Price**: $9.99/month
- **Quota**: 100 requests/minute (~6,000/hour)
- **Includes**: All endpoints, email support
- **Best For**: Small applications

### PRO
- **Price**: $49.99/month
- **Quota**: 500 requests/minute (~30,000/hour)
- **Includes**: Priority support, bulk operations
- **Best For**: Production applications

### ULTRA
- **Price**: $149.99/month
- **Quota**: 1,000 requests/minute (~60,000/hour)
- **Includes**: 24/7 support, SLA
- **Best For**: High-volume applications

### ENTERPRISE
- **Price**: Custom
- **Quota**: Unlimited
- **Includes**: Dedicated support, custom SLA, private deployment
- **Best For**: Enterprise needs

*(Adjust pricing based on your business model)*

---

## 🎨 Branding Assets

### Logo
- **Location**: TBD (upload square logo if available)
- **Suggested**: India map icon or location pin

### Icon
- **Suggested**: 📍 or 🗺️ emoji if no custom icon

### Cover Image
- **Suggested**: India map with pincode overlay or DIGIPIN grid visualization

---

## 📞 Support Information

### Support Email
```
support@codesense.in
```
*(or your preferred support email)*

### Documentation URL
```
https://pynpoint.codesense.in/api/docs
```

### Website
```
https://pynpoint.codesense.in
```

---

## ✅ Checklist for New Listing

- [ ] Copy **API Name** from above
- [ ] Copy **Short Description** (choose version based on char limit)
- [ ] Copy entire **Long Description** from `RAPIDAPI_LONG_DESCRIPTION.md`
- [ ] Upload **OpenAPI Spec**: `openapi-spec-public.json`
- [ ] Set **Base URL**: `https://pynpoint.codesense.in`
- [ ] Configure **Authentication**: X-API-Key (apiKey type)
- [ ] Add **README** from `RAPIDAPI_README.md` in Documentation tab
- [ ] Set **Category**: Location & Maps
- [ ] Add **Tags**: (see list above)
- [ ] Configure **Pricing Plans** (see suggested tiers)
- [ ] Test endpoint: POST /pincodes/reverse-geocode (should have NO examples)
- [ ] Test endpoint: POST /digipin/encode (SHOULD have examples as control)
- [ ] Verify **UUID error** resolved or isolated to specific endpoint

---

## 🧪 Post-Upload Testing

After creating the listing:

1. **Check Code Examples** in Column 3 for:
   - POST /pincodes/reverse-geocode (test - no examples)
   - POST /digipin/encode (control - has examples)

2. **Compare**:
   - Does test endpoint show UUID error?
   - Do control endpoints show UUID error?

3. **Report Findings** to determine if examples format was the issue

---

**Status**: Ready to create new listing! 🚀
