/**
 * Environment-aware utilities
 * Automatically detects if running on localhost or production
 */

/**
 * Get the base URL for the application
 * - Local: http://localhost:3000
 * - Production: https://fortiswealth.netlify.app
 */
export function getBaseUrl(): string {
  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Server-side: check environment variables
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  // Check if we're in production (Netlify sets this)
  if (process.env.NETLIFY || process.env.VERCEL_URL) {
    // Netlify provides the URL via environment variables
    if (process.env.URL) {
      return process.env.URL
    }
    if (process.env.DEPLOY_PRIME_URL) {
      return process.env.DEPLOY_PRIME_URL
    }
    // Fallback to production URL
    return 'https://fortiswealth.netlify.app'
  }

  // Development fallback
  return process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000'
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1')
  }
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if we're running locally
 */
export function isLocalhost(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.0.0.1')
  }
  return process.env.NODE_ENV === 'development' && !process.env.NETLIFY && !process.env.VERCEL_URL
}

