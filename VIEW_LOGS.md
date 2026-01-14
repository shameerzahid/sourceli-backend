# How to View Backend Logs

## Option 1: Check the Terminal Where Backend is Running

If you started the backend with `npm run dev`, the logs should be visible in that terminal window.

Look for:
- Server startup messages
- Request logs
- Database query logs
- Error messages
- Console.log statements

## Option 2: Restart Backend to See Logs

1. Open a new terminal
2. Navigate to backend directory:
   ```bash
   cd /Users/muhammad/Desktop/sourcelli/backend
   ```
3. Start the backend:
   ```bash
   npm run dev
   ```
4. You'll see all logs in real-time

## Option 3: Check Backend Logs via Terminal

If the backend is running in the background, you can:

1. Find the process:
   ```bash
   ps aux | grep "tsx.*server\|node.*server"
   ```

2. Check if there's a log file (if logging to file is configured)

## What to Look For

When testing the stats endpoint, you should see:

1. **Request received:**
   ```
   getAdminStatsHandler called
   ```

2. **Service started:**
   ```
   Starting getAdminStats...
   ```

3. **Database queries:**
   - Prisma query logs (if enabled)
   - Any database errors

4. **Response sent:**
   ```
   Admin stats calculated: { ... }
   getAdminStats completed, sending response
   ```

## Enable More Detailed Logging

Prisma logs are already enabled in development mode. You should see:
- Database queries
- Query execution time
- Errors

## Test the Endpoint Directly

You can also test the endpoint with curl to see backend response:

```bash
# First, get a valid token by logging in
# Then use it in the Authorization header
curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Common Issues

- **No logs appearing**: Backend might not be running, or logs are going to a different terminal
- **Request not reaching backend**: Check CORS, network, or if backend is actually running
- **Database connection errors**: Check DATABASE_URL in .env file
- **Token validation errors**: Check JWT_SECRET and token expiry


