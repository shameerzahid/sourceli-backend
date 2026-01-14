# Database Seeding Guide

This guide explains how to seed the database with initial data, including the admin user.

## Admin User Seeder

The seed script creates a default admin user that can be used to:
- Approve farmer applications
- Approve buyer registrations
- Manage user statuses
- Access all admin features

## Running the Seeder

### Basic Usage

```bash
cd backend
npm run prisma:seed
```

This will create an admin user with default credentials:
- **Email**: `admin@sourceli.com`
- **Phone**: `+1234567890`
- **Password**: `Admin123!`
- **Role**: `ADMIN`
- **Status**: `ACTIVE`

### Custom Credentials

You can set custom admin credentials using environment variables in your `.env` file:

```env
ADMIN_EMAIL=your@email.com
ADMIN_PHONE=+1234567890
ADMIN_PASSWORD=YourSecurePassword123!
```

Then run:
```bash
npm run prisma:seed
```

## Idempotency

The seed script is **idempotent**, meaning:
- ✅ Safe to run multiple times
- ✅ Won't create duplicate admin users
- ✅ Will update password if `ADMIN_PASSWORD` is set and admin exists
- ✅ Won't affect existing admin data

## Security Notes

⚠️ **IMPORTANT**: 
1. **Change the default password** after first login
2. Use strong passwords in production
3. Don't commit `.env` file with real credentials
4. Consider using environment-specific seeders for production

## What Gets Created

The seeder creates:
- ✅ One admin user with role `ADMIN` and status `ACTIVE`
- ✅ Hashed password (using bcrypt)
- ✅ Unique email and phone number

## Verification

After running the seeder, you can verify the admin user was created:

1. **Using Prisma Studio**:
   ```bash
   npm run prisma:studio
   ```
   Navigate to Users table and filter by role = ADMIN

2. **Using the API**:
   ```bash
   # Login with admin credentials
   POST /api/auth/login
   {
     "emailOrPhone": "admin@sourceli.com",
     "password": "Admin123!"
   }
   ```

3. **Using Database Query**:
   ```sql
   SELECT id, email, phone, role, status 
   FROM users 
   WHERE role = 'ADMIN';
   ```

## Troubleshooting

### Error: "Email already exists"
- The admin user already exists
- This is normal - the seeder is idempotent
- If you want to update the password, set `ADMIN_PASSWORD` in `.env` and run again

### Error: "Database connection failed"
- Check your `DATABASE_URL` in `.env`
- Ensure the database is running
- Verify network connectivity

### Error: "Module not found"
- Run `npm install` to install dependencies
- Run `npm run prisma:generate` to generate Prisma client

## Next Steps

After seeding:
1. ✅ Test admin login via API
2. ✅ Change default password
3. ✅ Start approving farmer/buyer registrations
4. ✅ Begin using admin features

## Production Considerations

For production environments:
- Use strong, unique passwords
- Store credentials securely (not in code)
- Consider using a secrets management service
- Rotate passwords regularly
- Use environment-specific seeders
- Document who has admin access


