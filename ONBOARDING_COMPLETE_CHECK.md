# Onboarding Completeness Check

## ✅ What's Complete

### Farmer Registration (US-FARMER-001)
- ✅ All form fields: full name, farm name (optional), phone, region, town, capacity range, produce category, feeding method
- ✅ Farm photo upload (multiple photos via Cloudinary)
- ✅ Status set to "Applied"
- ✅ Confirmation message returned
- ✅ No dashboard access until approval (enforced by status check)

### Buyer Registration (US-BUYER-001)
- ✅ All form fields: full name/business name, buyer type, contact person, phone, email
- ✅ Multiple delivery locations support
- ✅ Estimated weekly volume
- ✅ Status set to "Pending"
- ✅ Confirmation message returned
- ✅ No order placement until approval (enforced by status check)

---

## ❌ What's Missing

### 1. Platform Rules Agreement (Farmer Only)
**Requirement**: "Farmer must agree to platform rules, performance-based access, and no price negotiation policy"

**Status**: ❌ Not implemented

**Options**:
- **Option A**: Frontend-only (checkbox, not stored in DB) - Simple but no audit trail
- **Option B**: Store agreement in database - Better for audit/compliance

**Recommendation**: Add `termsAccepted` boolean field to `FarmerApplication` model

---

### 2. Email/SMS Notifications
**Requirement**: 
- "Farmer receives email/SMS notification when application is reviewed"
- "Buyer receives email/SMS notification when registration is reviewed"

**Status**: ❌ Not implemented (Notification system not built yet)

**Note**: This is a system-wide feature (US-SYS-002), not specific to onboarding. Can be added later.

---

### 3. Admin Approval Endpoints
**Requirement**:
- Admin can approve/reject farmer applications
- Admin can approve/reject buyer registrations
- Send approval/rejection messages with feedback

**Status**: ❌ Not implemented (Part of admin panel - Milestone 1 scope)

**Note**: This is the next step after onboarding is complete.

---

### 4. Login Credentials Upon Approval (Buyer)
**Requirement**: "Buyer receives login credentials upon approval"

**Status**: ❌ Not implemented

**Note**: This happens during admin approval, not during registration. Should be handled when admin approves buyer.

---

## 🎯 Immediate Action Items for Complete Onboarding

### Priority 1: Platform Rules Agreement (Farmer)
Add `termsAccepted` field to track agreement:

**Schema Change Needed**:
```prisma
model FarmerApplication {
  // ... existing fields
  termsAccepted Boolean @default(false) @map("terms_accepted")
  termsAcceptedAt DateTime? @map("terms_accepted_at")
}
```

**Implementation**:
1. Add field to schema
2. Update validator to require `termsAccepted: true`
3. Update service to save agreement
4. Update controller to accept agreement field

---

## 📊 Summary

| Feature | Status | Priority |
|---------|--------|----------|
| All form fields | ✅ Complete | - |
| Photo upload | ✅ Complete | - |
| Platform rules agreement | ❌ Missing | High |
| Email/SMS notifications | ❌ Missing | Medium (system feature) |
| Admin approval endpoints | ❌ Missing | High (next step) |
| Login credentials on approval | ❌ Missing | Medium (part of approval) |

---

## 🚀 Next Steps

1. **Add platform rules agreement** (15 min)
   - Update schema
   - Update validator
   - Update service/controller

2. **Build admin approval system** (next phase)
   - Approve/reject endpoints
   - Send notifications
   - Update user status

3. **Build notification system** (later)
   - Email/SMS integration
   - Notification queue
   - Templates


