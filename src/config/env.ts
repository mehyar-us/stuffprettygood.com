/**
 * Environment configuration
 * Automatically detects dev vs prod and uses appropriate API URLs
 */

export const env = {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,

    // Cloudflare Worker API (Serverless)
    workerApiUrl: import.meta.env.VITE_WORKER_API_URL || 'https://api.stuffprettygood.com',

    // Express Backend API (EC2)
    backendApiUrl: import.meta.env.VITE_BACKEND_API_URL || 'https://backend.stuffprettygood.com',
} as const;

export default env;
