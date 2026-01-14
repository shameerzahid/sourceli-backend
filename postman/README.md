# Postman Collection for Sourceli API

This directory contains the Postman collection for testing the Sourceli API endpoints.

## Setup Instructions

### 1. Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select `Sourceli_API.postman_collection.json`
4. Collection will appear in your workspace

### 2. Set Environment Variables (Optional)

Create a Postman environment with these variables:

- `baseUrl`: `http://localhost:3001` (default)
- `accessToken`: (auto-set after login)
- `refreshToken`: (auto-set after login)
- `userId`: (auto-set after login)
- `userRole`: (auto-set after login)
- `resetToken`: (auto-set after forgot password in dev mode)

### 3. Configure Cloudinary (Required for Photo Uploads)

Farmer registration requires photo uploads via Cloudinary. Set up Cloudinary:

1. See `../CLOUDINARY_SETUP.md` for detailed instructions
2. Add Cloudinary credentials to your `.env` file:
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

### 4. Start the Server

```bash
cd backend
npm run dev
```

The server should start on `http://localhost:3001`

## Collection Structure

### Health Check
- **GET /health** - Check if API is running

### API Info
- **GET /api** - Get API information and available endpoints

### Authentication Endpoints

#### Public Routes (No Auth Required)

1. **Register Farmer**
   - `POST /api/auth/register/farmer`
   - **Content-Type**: `multipart/form-data`
   - **Required**: All form fields + at least 1 farm photo (up to 10)
   - **Photo Requirements**: JPEG, PNG, WebP | Max 5MB per image
   - Creates farmer application (status: APPLIED)
   - Photos are uploaded to Cloudinary
   - Requires admin approval

2. **Register Buyer**
   - `POST /api/auth/register/buyer`
   - Creates buyer registration (status: PENDING)
   - Requires admin approval

3. **Login**
   - `POST /api/auth/login`
   - Login with email/phone + password
   - Returns access token and refresh token
   - Auto-saves tokens to environment variables

4. **Forgot Password**
   - `POST /api/auth/forgot-password`
   - Request password reset
   - In dev mode, returns reset token

5. **Verify Reset Token**
   - `GET /api/auth/verify-reset-token/:token`
   - Check if reset token is valid

6. **Reset Password**
   - `POST /api/auth/reset-password`
   - Reset password using token

#### Protected Routes (Auth Required)

7. **Get Current User Profile**
   - `GET /api/auth/me`
   - Requires: `Authorization: Bearer <accessToken>`
   - Returns user profile with role-specific data

8. **Refresh Access Token**
   - `POST /api/auth/refresh`
   - Refresh access token using refresh token
   - Auto-updates tokens in environment

9. **Logout**
   - `POST /api/auth/logout`
   - Requires: `Authorization: Bearer <accessToken>`
   - Logout current user

10. **Change Password**
    - `POST /api/auth/change-password`
    - Requires: `Authorization: Bearer <accessToken>`
    - Change password for authenticated users

## Testing Workflow

### 1. Test Registration

1. **Register Farmer**
   - Use "Register Farmer" request
   - **Important**: This uses `multipart/form-data` (not JSON)
   - Fill in all form fields
   - **Upload at least 1 farm photo** (click "Select Files" next to photos field)
   - You can upload multiple photos (up to 10)
   - Update email/phone to unique values
   - Should return 201 with userId, applicationId, and photosUploaded count
   - **Note**: Cloudinary must be configured (see CLOUDINARY_SETUP.md)

2. **Register Buyer**
   - Use "Register Buyer" request
   - Update email/phone to unique values
   - Should return 201 with userId and registrationId

### 2. Test Login (After Admin Approval)

**Note**: Users with status PENDING or APPLIED cannot login. You need admin approval first.

Once approved:
1. Use "Login" request
2. Tokens are automatically saved to environment
3. Should return 200 with accessToken and refreshToken

### 3. Test Protected Routes

1. **Get Profile**
   - Use "Get Current User Profile"
   - Should return user data with role-specific info

2. **Refresh Token**
   - Use "Refresh Access Token"
   - Should return new tokens

3. **Change Password**
   - Use "Change Password"
   - Requires current password

### 4. Test Password Reset

1. **Forgot Password**
   - Use "Forgot Password"
   - In dev mode, reset token is returned

2. **Verify Token**
   - Use "Verify Reset Token" with token from step 1

3. **Reset Password**
   - Use "Reset Password" with token and new password

## Rate Limiting

- **Auth endpoints**: 5 requests per 15 minutes per IP
- **General API**: 100 requests per 15 minutes per IP

If you hit rate limits, wait 15 minutes or restart the server.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email/phone)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Notes

- All timestamps are in ISO 8601 format
- Passwords must be at least 8 characters
- Email and phone must be unique
- Users cannot login until admin approves (status must be ACTIVE or PROBATIONARY)
- In development mode, reset tokens are returned in response (not secure for production)
- **Farmer registration uses multipart/form-data** (not JSON) for photo uploads
- **Cloudinary must be configured** for farmer photo uploads to work
- Photos are automatically optimized and stored in Cloudinary
- Minimum 1 photo required for farmer registration, maximum 10 photos

## Next Steps

After testing authentication, you can:
1. Create admin user via database seeder
2. Test admin approval endpoints (when implemented)
3. Test user management endpoints (when implemented)

