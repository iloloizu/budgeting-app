/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do NOT use 'output: export' - this app has API routes that require a server
  // API routes cannot be statically exported
  // For deployment, use a platform that supports serverless functions:
  // - Vercel (recommended for Next.js)
  // - Netlify
  // - Railway
  // - AWS Amplify
  // GitHub Pages only supports static sites and cannot host API routes

  // Environment-aware configuration
  // The app automatically detects the environment:
  // - Local: http://localhost:3000 (when running `npm run dev`)
  // - Production: https://fortiswealth.netlify.app (when deployed to Netlify)
  // All API routes use relative paths (/api/...) so they work in both environments
}

module.exports = nextConfig

