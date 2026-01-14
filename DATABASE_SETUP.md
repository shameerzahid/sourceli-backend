# Database Setup Guide

This guide will help you set up a free PostgreSQL database for the Sourceli project.

## 🏆 Recommended: Neon (Best Choice)

**Why Neon?**
- ✅ **Free tier**: 0.5GB storage, unlimited projects
- ✅ **Serverless**: Auto-scales, no server management
- ✅ **Fast**: Low latency, global distribution
- ✅ **Easy setup**: 2-minute setup
- ✅ **Modern**: Built for modern applications
- ✅ **Branching**: Database branching (like Git)
- ✅ **Free forever**: No credit card required for free tier

### Step-by-Step: Neon Setup

#### Step 1: Create Account
1. Go to **https://neon.tech**
2. Click **"Sign Up"** (top right)
3. Sign up with:
   - GitHub (recommended - fastest)
   - Google
   - Email

#### Step 2: Create Project
1. After login, click **"Create Project"**
2. Fill in:
   - **Project name**: `sourcelli` (or any name)
   - **Region**: Choose closest to you (e.g., `US East`, `EU West`)
   - **PostgreSQL version**: `15` (default is fine)
3. Click **"Create Project"**

#### Step 3: Get Connection String
1. After project creation, you'll see the dashboard
2. Look for **"Connection string"** section
3. You'll see something like:
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. Click **"Copy"** to copy the connection string

#### Step 4: Add to Your Project
1. In your project, go to `backend/.env` file
2. Add the connection string:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"
   ```
3. Save the file

#### Step 5: Test Connection
Run this command to test:
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

**That's it!** Your database is ready! 🎉

---

## Alternative Options

### Option 2: Supabase (Also Great)

**Why Supabase?**
- ✅ **Free tier**: 500MB database, 2GB bandwidth
- ✅ **Full platform**: Database + Auth + Storage + APIs
- ✅ **Dashboard**: Great admin UI
- ✅ **Real-time**: Built-in real-time features
- ✅ **Open source**: Self-hostable

**Setup Steps:**
1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub/Google
4. Click **"New Project"**
5. Fill in:
   - **Name**: `sourcelli`
   - **Database Password**: (save this!)
   - **Region**: Choose closest
6. Wait 2 minutes for setup
7. Go to **Settings** → **Database**
8. Find **"Connection string"** → **"URI"**
9. Copy the connection string
10. Add to `backend/.env` as `DATABASE_URL`

**Connection String Format:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
```

---

### Option 3: Railway (Simple & Fast)

**Why Railway?**
- ✅ **Free tier**: $5 credit/month
- ✅ **Simple**: Very easy setup
- ✅ **Fast**: Quick deployments
- ✅ **Good for MVP**: Perfect for development

**Setup Steps:**
1. Go to **https://railway.app**
2. Sign up with GitHub
3. Click **"New Project"**
4. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
5. Wait for database to provision
6. Click on the database
7. Go to **"Variables"** tab
8. Copy the `DATABASE_URL`
9. Add to `backend/.env`

---

### Option 4: Render (Reliable)

**Why Render?**
- ✅ **Free tier**: 90-day free PostgreSQL
- ✅ **Reliable**: Good uptime
- ✅ **Simple**: Easy to use

**Setup Steps:**
1. Go to **https://render.com**
2. Sign up with GitHub/Email
3. Click **"New +"** → **"PostgreSQL"**
4. Fill in:
   - **Name**: `sourcelli-db`
   - **Database**: `sourcelli`
   - **User**: `sourcelli_user`
   - **Region**: Choose closest
5. Click **"Create Database"**
6. Wait 2-3 minutes
7. Copy the **"Internal Database URL"** or **"External Database URL"**
8. Add to `backend/.env`

---

### Option 5: Local PostgreSQL (Development Only)

**For local development only** - not for production.

**Setup Steps (macOS):**
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb sourcelli

# Connection string for .env:
DATABASE_URL="postgresql://localhost:5432/sourcelli"
```

**Setup Steps (Windows):**
1. Download from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password you set
4. Connection string:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/sourcelli"
   ```

---

## Comparison Table

| Feature | Neon | Supabase | Railway | Render | Local |
|--------|------|----------|--------|--------|-------|
| **Free Tier** | ✅ 0.5GB | ✅ 500MB | ✅ $5/mo | ⚠️ 90 days | ✅ Unlimited |
| **Setup Time** | 2 min | 3 min | 2 min | 3 min | 10 min |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Dashboard** | ✅ Good | ✅ Excellent | ✅ Good | ✅ Basic | ❌ None |
| **Auto-scaling** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | ❌ No |
| **Best For** | Production | Full stack | MVP | Simple apps | Dev only |

---

## 🎯 My Recommendation

**For Milestone 1 (Development):**
1. **Neon** - Best overall experience
2. **Supabase** - If you want extra features later
3. **Local** - If you prefer offline development

**For Production (Later):**
- Start with **Neon** or **Supabase**
- Both can scale as you grow
- Easy to migrate if needed

---

## Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use strong passwords** - Auto-generated is best
3. **Enable SSL** - All providers do this by default
4. **Rotate secrets** - Change passwords periodically
5. **Use connection pooling** - Neon/Supabase handle this automatically

---

## Troubleshooting

### Connection Error?
- Check if connection string is correct
- Verify database is running (for local)
- Check firewall settings
- Ensure SSL is enabled (for cloud)

### "Database does not exist"?
- Create the database first
- Or use the default database name from provider

### Slow connections?
- Choose region closest to you
- Use connection pooling (Neon/Supabase auto-enable)

---

## Next Steps After Database Setup

1. ✅ Copy connection string to `backend/.env`
2. ✅ Run `npm install` in backend folder
3. ✅ Run `npm run prisma:generate`
4. ✅ Run `npm run prisma:migrate` (after schema is created)
5. ✅ Test connection with `npm run dev`

---

## Quick Start Commands

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Generate Prisma client
npm run prisma:generate

# 3. Create first migration (after schema is ready)
npm run prisma:migrate dev --name init

# 4. Open Prisma Studio (database GUI)
npm run prisma:studio
```

---

**Need Help?** 
- Neon Docs: https://neon.tech/docs
- Supabase Docs: https://supabase.com/docs
- Prisma Docs: https://www.prisma.io/docs


