# Environment Configuration

This app automatically works in both local development and production environments.

## How It Works

### Local Development (localhost)
- **URL**: `http://localhost:3000`
- **When**: Running `npm run dev` locally
- **API Routes**: Automatically use `http://localhost:3000/api/...`

### Production (Netlify)
- **URL**: `https://fortiswealth.netlify.app`
- **When**: Deployed to Netlify
- **API Routes**: Automatically use `https://fortiswealth.netlify.app/api/...`

## Automatic Detection

The app uses **relative paths** for all API calls (e.g., `/api/transactions`), which means:
- ✅ No configuration needed
- ✅ Works automatically on localhost
- ✅ Works automatically in production
- ✅ No hardcoded URLs

## Environment Variables

### Required for Local Development
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://..."
ANTHROPIC_API_KEY="sk-ant-..."
NEXT_PUBLIC_TELLER_APPLICATION_ID="app_..."
NEXT_PUBLIC_TELLER_ENVIRONMENT="sandbox"
```

### Required for Production (Netlify)
Set these in Netlify Dashboard → Site settings → Environment variables:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `NEXT_PUBLIC_TELLER_APPLICATION_ID` - Your Teller application ID
- `NEXT_PUBLIC_TELLER_ENVIRONMENT` - `sandbox`, `development`, or `production`
- `TELLER_CERT` / `TELLER_KEY` - Teller client certificate and key (optional)
- `TELLER_TOKEN_SIGNING_KEY` - Teller token signing key (optional)

## Testing Locally

1. Make sure your `.env` file is set up correctly
2. Run `npm run dev`
3. Open `http://localhost:3000`
4. The app will automatically use localhost for all API calls

## Deploying to Production

1. Push your code to GitHub
2. Netlify will automatically build and deploy
3. Set environment variables in Netlify Dashboard
4. The app will automatically use `https://fortiswealth.netlify.app` for all API calls

## Utility Functions

If you need to get the base URL programmatically, use the utility in `lib/env.ts`:

```typescript
import { getBaseUrl, isProduction, isLocalhost } from '@/lib/env'

// Get the current base URL
const baseUrl = getBaseUrl() // "http://localhost:3000" or "https://fortiswealth.netlify.app"

// Check environment
if (isLocalhost()) {
  // Running locally
}

if (isProduction()) {
  // Running in production
}
```

## Notes

- All API routes (`/api/*`) use relative paths, so they work in both environments
- Next.js automatically handles the base URL based on where the app is running
- No need to change any code when switching between local and production

