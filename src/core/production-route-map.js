export const PRODUCTION_ROUTE_MAP = Object.freeze({
  sameServer: true,
  hosts: Object.freeze({
    brand: 'stuffprettygood.com',
    crm: 'mehyarmedia.mehyar.us',
  }),
  publicRoutes: Object.freeze([
    Object.freeze({
      path: '/',
      owner: 'brand-site',
      upstream: 'Hostinger nginx static/site root',
      healthRole: 'brand_home',
    }),
    Object.freeze({
      path: '/health',
      owner: 'brand-site',
      upstream: 'Hostinger nginx static/site health',
      healthRole: 'brand_health',
    }),
    Object.freeze({
      path: '/crm/health',
      owner: 'crm-command-center',
      upstream: 'http://127.0.0.1:3000/health',
      healthRole: 'crm_health',
    }),
    Object.freeze({
      path: '/crm/api/*',
      owner: 'crm-command-center',
      upstream: 'http://127.0.0.1:3000/api/*',
      healthRole: 'crm_api',
    }),
  ]),
  compatibilityRoutes: Object.freeze([
    Object.freeze({
      path: '/crm-health',
      status: 'public_alias',
      equivalentTo: '/crm/health',
      reason: 'preserve the original monitoring endpoint while keeping CRM API routes under /crm/',
    }),
  ]),
  nonCanonicalRoutes: Object.freeze([
    Object.freeze({
      path: '/healthz',
      status: 'internal-only',
      replacement: '/crm/health',
      reason: 'avoid exposing service-internal health names at the brand-site root',
    }),
  ]),
});

export function crmHealthPath() {
  return PRODUCTION_ROUTE_MAP.publicRoutes.find((route) => route.healthRole === 'crm_health').path;
}
