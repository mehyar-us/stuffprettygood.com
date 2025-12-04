/**
 * Environment configuration
 * Automatically detects dev vs prod and uses appropriate API URLs
 */

export const env = {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    apiUrl: import.meta.env.VITE_API_URL || 'https://api.stuffprettygood.com',
} as const;

export default env;
