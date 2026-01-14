# Cloudinary Setup Guide

This guide explains how to set up Cloudinary for image uploads in the Sourceli platform.

## Why Cloudinary?

Cloudinary provides:
- ✅ Automatic image optimization
- ✅ CDN delivery for fast loading
- ✅ Image transformations (resize, crop, etc.)
- ✅ Secure cloud storage
- ✅ Free tier available (25GB storage, 25GB bandwidth/month)

## Setup Steps

### 1. Create Cloudinary Account

1. Go to **https://cloudinary.com**
2. Click **"Sign Up for Free"**
3. Sign up with:
   - Email
   - GitHub (recommended)
   - Google

### 2. Get Your Credentials

After signing up:

1. Go to **Dashboard**
2. You'll see your credentials:
   - **Cloud Name** (e.g., `dxyz12345`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Add to Environment Variables

Add these to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**⚠️ Important**: Never commit your `.env` file with real credentials!

### 4. Verify Setup

Start your server:

```bash
npm run dev
```

If Cloudinary is configured correctly, you won't see any warnings. If you see:
```
⚠️  Cloudinary not configured. Image uploads will be disabled.
```

Check that all three environment variables are set correctly.

## How It Works

### Farmer Registration with Photos

1. **Frontend** sends `multipart/form-data` with:
   - Form fields (email, phone, password, etc.)
   - Photo files (up to 10 images)

2. **Backend**:
   - Validates images (type, size)
   - Uploads each image to Cloudinary
   - Stores Cloudinary URLs in database
   - Links photos to farmer application

### Image Storage Structure

Images are stored in Cloudinary with this structure:
```
sourceli/farm-photos/farmer-{timestamp}-{random}
```

### Image Optimization

Cloudinary automatically:
- Optimizes image quality
- Converts to appropriate format (WebP when supported)
- Maintains aspect ratio
- Compresses for web delivery

## API Usage

### Upload Images

When registering a farmer, include photos in the request:

```javascript
const formData = new FormData();
formData.append('email', 'farmer@example.com');
formData.append('phone', '+1234567890');
// ... other fields
formData.append('photos', file1); // First photo
formData.append('photos', file2); // Second photo
// ... up to 10 photos

fetch('/api/auth/register/farmer', {
  method: 'POST',
  body: formData
});
```

### Image Requirements

- **Formats**: JPEG, JPG, PNG, WebP
- **Max size**: 5MB per image
- **Max count**: 10 images per registration
- **Min count**: 1 image required

## Free Tier Limits

Cloudinary free tier includes:
- ✅ 25GB storage
- ✅ 25GB bandwidth/month
- ✅ 25,000 transformations/month
- ✅ Unlimited uploads

For most MVP use cases, this is sufficient.

## Production Considerations

1. **Upgrade Plan**: Consider paid plan for production
2. **Backup Strategy**: Cloudinary provides automatic backups
3. **CDN**: Images are automatically served via CDN
4. **Security**: Use signed uploads for production
5. **Monitoring**: Monitor usage in Cloudinary dashboard

## Troubleshooting

### Error: "Cloudinary is not configured"
- Check that all three environment variables are set
- Restart server after adding variables
- Verify credentials in Cloudinary dashboard

### Error: "Failed to upload image"
- Check internet connection
- Verify Cloudinary credentials are correct
- Check Cloudinary dashboard for account status
- Verify file size is under 5MB

### Images not appearing
- Check Cloudinary dashboard for uploaded images
- Verify URLs are stored correctly in database
- Check CORS settings if accessing from frontend

## Next Steps

1. ✅ Set up Cloudinary account
2. ✅ Add credentials to `.env`
3. ✅ Test farmer registration with photos
4. ✅ Verify images appear in Cloudinary dashboard
5. ✅ Test image retrieval in admin panel


