# Quick Start Guide - Database Setup

## 🚀 Fastest Way: Neon (Recommended)

### 5-Minute Setup

1. **Sign up**: https://neon.tech → Sign up with GitHub
2. **Create project**: Click "Create Project" → Name it `sourcelli`
3. **Copy connection string**: Dashboard → Copy connection string
4. **Add to .env**: 
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and paste your DATABASE_URL
   ```
5. **Done!** ✅

### Connection String Format
```
postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

---

## Alternative: Supabase (Also Great)

1. **Sign up**: https://supabase.com → Start your project
2. **New project**: Name it `sourcelli`, choose region
3. **Get connection**: Settings → Database → Connection string (URI)
4. **Add to .env**: Same as above

---

## After Database Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Test server
npm run dev
```

Visit: http://localhost:3001/health

---

## Need Help?

See `DATABASE_SETUP.md` for detailed instructions and troubleshooting.


