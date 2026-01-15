# Vercel Deployment Guide

## Required Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### Required Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - At least 32 characters (for access tokens)
- `JWT_REFRESH_SECRET` - At least 32 characters (for refresh tokens)

### Optional Variables

- `NODE_ENV` - Set to `production` (defaults to `development`)
- `PORT` - Server port (defaults to `3001`, not used in serverless)
- `JWT_EXPIRES_IN` - Access token expiration (defaults to `1h`)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration (defaults to `7d`)
- `CORS_ORIGIN` - Allowed CORS origin (defaults to `http://localhost:3000`)
- `CORS_ORIGINS` - Multiple allowed CORS origins, comma-separated (e.g., `http://localhost:3000,https://sourceli-frontend.vercel.app`)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (optional)
- `CLOUDINARY_API_KEY` - Cloudinary API key (optional)
- `CLOUDINARY_API_SECRET` - Cloudinary API secret (optional)

## Build Configuration

Vercel will automatically:
1. Run `npm install`
2. Run `npm run vercel-build` (which generates Prisma client)
3. Deploy the serverless function

## Prisma Setup

Make sure your `schema.prisma` file is committed and Prisma client is generated during build.

The `vercel-build` script in `package.json` runs `prisma generate` to create the Prisma client.

## Troubleshooting

### Function Crashes

1. **Check Environment Variables**: Ensure all required variables are set in Vercel
2. **Check Prisma Client**: Ensure `prisma generate` runs during build
3. **Check Logs**: View function logs in Vercel dashboard for specific errors

### Common Issues

- **Missing DATABASE_URL**: Function will crash on startup
- **Invalid JWT_SECRET**: Must be at least 32 characters
- **Prisma Client Not Generated**: Add `vercel-build` script to package.json

