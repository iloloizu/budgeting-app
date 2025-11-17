# Neon Database Setup Verification

## Step-by-Step Verification Checklist

### 1. ✅ Verify Your Connection String Format

Your `DATABASE_URL` should look like this:
```
postgresql://neondb_owner:npg_l3mLDaPWnQ9h@ep-bitter-water-ae1zkl8t-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

**Key components:**
- ✅ Starts with `postgresql://`
- ✅ Has `-pooler` in the hostname (good for serverless)
- ✅ Has `sslmode=require` (required for Neon)
- ✅ Has database name at the end (`neondb`)

### 2. ✅ Test Connection Locally

Run this command to test your Neon connection:

```bash
# Set your Neon connection string
export DATABASE_URL="postgresql://neondb_owner:npg_l3mLDaPWnQ9h@ep-bitter-water-ae1zkl8t-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

# Test the connection
npm run db:test
```

This will:
- ✅ Test the database connection
- ✅ Verify tables exist
- ✅ Test creating/deleting a user
- ✅ Show any errors with helpful messages

### 3. ✅ Verify Schema is Pushed to Neon

Run this to push your schema:

```bash
export DATABASE_URL="postgresql://neondb_owner:npg_l3mLDaPWnQ9h@ep-bitter-water-ae1zkl8t-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
npx prisma db push
```

You should see:
```
✅ Your database is now in sync with your Prisma schema
```

### 4. ✅ Verify Netlify Environment Variables

In Netlify Dashboard → Site settings → Environment variables:

**Required:**
- ✅ `DATABASE_URL` = Your Neon connection string (all deploy contexts)
- ✅ `NEXT_PUBLIC_TELLER_APPLICATION_ID` = Your Teller app ID
- ✅ `NEXT_PUBLIC_TELLER_ENVIRONMENT` = sandbox/development/production

**Optional:**
- `ANTHROPIC_API_KEY` = For LLM assistant
- `TELLER_CERT_PATH` / `TELLER_CERT` = Teller certificate
- `TELLER_KEY_PATH` / `TELLER_KEY` = Teller private key
- `TELLER_TOKEN_SIGNING_KEY` = Teller signing key

### 5. ✅ Check Netlify Function Logs

If you're still getting 500 errors:

1. Go to Netlify Dashboard → Functions
2. Click on a function (e.g., `/api/users`)
3. View the logs to see the actual error message

The improved error logging we added will show:
- Error message
- Error code (e.g., P1001 = connection error, P2025 = not found)
- Detailed error information

### 6. ✅ Common Issues and Solutions

**Issue: "relation does not exist" or "table does not exist"**
- **Solution:** Run `npx prisma db push` with your Neon DATABASE_URL

**Issue: "Can't reach database server" (P1001)**
- **Solution:** Check your connection string, verify Neon database is running

**Issue: "Connection timeout"**
- **Solution:** Make sure you're using the pooled connection (has `-pooler` in hostname)

**Issue: "SSL connection required"**
- **Solution:** Make sure `sslmode=require` is in your connection string

### 7. ✅ Verify Build is Working

After pushing code, check Netlify build logs:
- ✅ `prisma generate` runs successfully
- ✅ Build completes without errors
- ✅ No Prisma Client initialization errors

## Quick Test Commands

```bash
# 1. Test connection
export DATABASE_URL="your-neon-connection-string"
npm run db:test

# 2. Push schema
npx prisma db push

# 3. Open Prisma Studio to view data
npx prisma studio
```

## Still Having Issues?

1. **Check Netlify Function Logs** - They'll show the exact error
2. **Test locally** - Use `npm run db:test` to verify connection works
3. **Verify environment variables** - Make sure `DATABASE_URL` is set in all deploy contexts
4. **Check Neon Dashboard** - Verify your database is active and accessible

