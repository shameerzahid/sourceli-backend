# Registration Fields Analysis

## ✅ Current Status vs Requirements

### Farmer Registration

#### ✅ Fields We Have (Correct):
- ✅ Email (required for login)
- ✅ Phone (required)
- ✅ Password (required for login)
- ✅ Full name
- ✅ Farm name (optional)
- ✅ Region
- ✅ Town
- ✅ Weekly capacity (min/max range)
- ✅ Produce category
- ✅ Feeding method

#### ❌ Missing Fields (Required by Requirements):
- ❌ **Farm Photos** - "Farmer can upload multiple farm photos (housing, animals, produce)"
  - Requirements: US-FARMER-001 states: "Farmer can upload multiple farm photos (housing, animals, produce)"
  - Admin needs to review photos during verification (US-ADMIN-001)
  - We have FarmPhoto model in schema but no upload during registration

#### 📝 Additional Notes:
- Platform rules agreement (mentioned in requirements but not stored in DB - can be handled in frontend)

---

### Buyer Registration

#### ✅ Fields We Have (All Match Requirements):
- ✅ Email (required)
- ✅ Phone (required)
- ✅ Password (required for login)
- ✅ Full name(s) or business name
- ✅ Business name (optional)
- ✅ Buyer type (RESTAURANT, HOTEL, CATERER, INDIVIDUAL)
- ✅ Contact person
- ✅ Estimated weekly volume (optional)
- ✅ Delivery location(s) (multiple addresses supported)

#### ✅ Complete - No Missing Fields

---

## 🔧 Required Fixes

### 1. Add Farm Photo Upload to Farmer Registration

**What's needed:**
1. Update registration endpoint to accept multipart/form-data (for file uploads)
2. Add file upload middleware (multer)
3. Validate uploaded images (type, size)
4. Save photos to storage (local for MVP, cloud-ready structure)
5. Link photos to farmer during registration
6. Update validator to accept photo files
7. Update service to save photos

**Implementation Plan:**
- Use `multer` for file uploads
- Accept multiple photos (min 1, max 10 recommended)
- Validate: images only (jpg, jpeg, png), max 5MB per file
- Store in `uploads/farm-photos/` directory
- Save file paths to database via FarmPhoto model

---

## 📋 Summary

| Registration Type | Status | Missing Fields |
|------------------|--------|----------------|
| **Farmer** | ⚠️ Incomplete | Farm photos upload |
| **Buyer** | ✅ Complete | None |

---

## 🎯 Action Items

1. ✅ Verify all required fields are in schema
2. ❌ Add farm photo upload functionality
3. ❌ Update farmer registration endpoint to handle file uploads
4. ❌ Add file validation and storage
5. ❌ Update Postman collection with multipart/form-data example


