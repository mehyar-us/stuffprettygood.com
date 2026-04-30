export const MAX_PREVIEW_LIMIT = 100;
export const MAX_MATERIALIZATION_LIMIT = 50_000;

export const RISK_TIERS = Object.freeze({
  low: { maxSuppressionOverlapRate: 0.05, maxEstimatedCount: 10_000 },
  medium: { maxSuppressionOverlapRate: 0.15, maxEstimatedCount: 50_000 },
  high: { maxSuppressionOverlapRate: 1, maxEstimatedCount: Number.POSITIVE_INFINITY },
});

const ALLOWED_CHANNELS = Object.freeze(['email', 'sms']);
const ALLOWED_CONSENT_STATES = Object.freeze(['explicit', 'implied', 'unknown']);

export function evaluateSegmentPlan({
  name = 'Untitled segment',
  channel = 'email',
  filters = {},
  counts = {},
  materialization = {},
  now = new Date().toISOString(),
} = {}) {
  const normalizedFilters = normalizeFilters(filters);
  const normalizedCounts = normalizeCounts(counts);
  const reasons = validateSegmentRequest({ channel, filters: normalizedFilters, counts: normalizedCounts, materialization });
  const suppression = computeSuppressionOverlap(normalizedCounts);
  const riskTier = determineRiskTier({ filters: normalizedFilters, counts: normalizedCounts, suppression });
  const previewQuery = buildPreviewQuery(normalizedFilters, channel);
  const materializationDecision = evaluateMaterialization({
    requested: Boolean(materialization.requested),
    approved: Boolean(materialization.approved),
    requestedLimit: materialization.limit,
    counts: normalizedCounts,
    riskTier,
    baseReasons: reasons,
  });

  return {
    ok: reasons.length === 0,
    name,
    channel,
    evaluatedAt: now,
    filters: normalizedFilters,
    counts: normalizedCounts,
    suppressionOverlap: suppression,
    riskTier,
    preview: {
      safe: reasons.length === 0,
      limit: MAX_PREVIEW_LIMIT,
      query: previewQuery,
    },
    materialization: materializationDecision,
    reasons,
    guardrails: [
      'read-only legacy source access only',
      'preview queries always use bounded LIMIT and deterministic ordering',
      'counts must be reviewed before activation or materialization',
      'suppression overlap is calculated before list creation',
      'no full-table pulls or blind imports are permitted',
    ],
  };
}

function normalizeFilters(filters) {
  return {
    sourceIds: uniqueStrings(filters.sourceIds),
    dateRange: normalizeDateRange(filters.dateRange),
    email: normalizeContactFilter(filters.email),
    phone: normalizeContactFilter(filters.phone),
    geo: normalizeGeoFilter(filters.geo),
    consentStates: uniqueStrings(filters.consentStates).filter((state) => ALLOWED_CONSENT_STATES.includes(state)),
    excludeUnsubscribed: filters.excludeUnsubscribed !== false,
    excludeSuppressed: filters.excludeSuppressed !== false,
  };
}

function normalizeCounts(counts) {
  const estimatedTotal = nonNegativeInteger(counts.estimatedTotal);
  const suppressedCount = nonNegativeInteger(counts.suppressedCount);
  return {
    estimatedTotal,
    suppressedCount,
    usableCount: Math.max(estimatedTotal - suppressedCount, 0),
    countsReviewedAt: counts.countsReviewedAt || null,
  };
}

function validateSegmentRequest({ channel, filters, counts, materialization }) {
  const reasons = [];

  if (!ALLOWED_CHANNELS.includes(channel)) {
    reasons.push(`unsupported channel: ${channel}`);
  }
  if (filters.sourceIds.length === 0) {
    reasons.push('at least one source filter is required');
  }
  if (!filters.dateRange.from || !filters.dateRange.to) {
    reasons.push('bounded dateRange.from and dateRange.to are required');
  }
  if (filters.dateRange.from && filters.dateRange.to && filters.dateRange.from > filters.dateRange.to) {
    reasons.push('dateRange.from must be before dateRange.to');
  }
  if (channel === 'email' && filters.email.required !== true) {
    reasons.push('email channel requires email.required=true');
  }
  if (channel === 'sms' && filters.phone.required !== true) {
    reasons.push('SMS channel requires phone.required=true');
  }
  if (!filters.excludeUnsubscribed) {
    reasons.push('unsubscribed records must be excluded');
  }
  if (!filters.excludeSuppressed) {
    reasons.push('suppressed records must be excluded');
  }
  if (!counts.countsReviewedAt) {
    reasons.push('safe count review is required before segment activation');
  }
  if (counts.estimatedTotal <= 0) {
    reasons.push('estimatedTotal must be greater than zero');
  }
  if (counts.suppressedCount > counts.estimatedTotal) {
    reasons.push('suppressedCount cannot exceed estimatedTotal');
  }
  if (materialization.requested && !materialization.approved) {
    reasons.push('materialization requires explicit approval');
  }

  return reasons;
}

function computeSuppressionOverlap(counts) {
  const rate = counts.estimatedTotal > 0 ? counts.suppressedCount / counts.estimatedTotal : 0;
  return {
    suppressedCount: counts.suppressedCount,
    usableCount: counts.usableCount,
    rate: Number(rate.toFixed(4)),
  };
}

function determineRiskTier({ filters, counts, suppression }) {
  if (suppression.rate > RISK_TIERS.medium.maxSuppressionOverlapRate || counts.estimatedTotal > RISK_TIERS.medium.maxEstimatedCount) {
    return 'high';
  }
  if (
    suppression.rate > RISK_TIERS.low.maxSuppressionOverlapRate ||
    counts.estimatedTotal > RISK_TIERS.low.maxEstimatedCount ||
    filters.consentStates.includes('unknown')
  ) {
    return 'medium';
  }
  return 'low';
}

function evaluateMaterialization({ requested, approved, requestedLimit, counts, riskTier, baseReasons }) {
  const limit = Math.min(nonNegativeInteger(requestedLimit || counts.usableCount), MAX_MATERIALIZATION_LIMIT);
  const reasons = [];

  if (!requested) {
    return { requested: false, allowed: false, limit: 0, reasons: ['materialization not requested'] };
  }
  if (!approved) reasons.push('materialization requires explicit approval');
  if (baseReasons.length > 0) reasons.push('segment must pass safety checks before materialization');
  if (riskTier === 'high') reasons.push('high-risk segments require manual compliance review before materialization');
  if (limit <= 0) reasons.push('materialization limit must be greater than zero');

  return {
    requested,
    allowed: reasons.length === 0,
    limit,
    maxLimit: MAX_MATERIALIZATION_LIMIT,
    reasons,
  };
}

function buildPreviewQuery(filters, channel) {
  const clauses = [
    'source_id = ANY(:sourceIds)',
    'created_at >= :dateFrom',
    'created_at < :dateTo',
  ];

  if (channel === 'email') clauses.push('email IS NOT NULL');
  if (channel === 'sms') clauses.push('phone IS NOT NULL');
  if (filters.geo.countries.length > 0) clauses.push('country = ANY(:countries)');
  if (filters.geo.regions.length > 0) clauses.push('region = ANY(:regions)');
  if (filters.consentStates.length > 0) clauses.push('consent_state = ANY(:consentStates)');
  if (filters.excludeUnsubscribed) clauses.push('unsubscribed_at IS NULL');
  if (filters.excludeSuppressed) clauses.push('NOT EXISTS (SELECT 1 FROM suppressions s WHERE s.contact_hash = legacy_signups.contact_hash)');

  return {
    text: `SELECT id, source_id, created_at, country, region, consent_state FROM legacy_signups WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${MAX_PREVIEW_LIMIT}`,
    parameters: {
      sourceIds: filters.sourceIds,
      dateFrom: filters.dateRange.from,
      dateTo: filters.dateRange.to,
      countries: filters.geo.countries,
      regions: filters.geo.regions,
      consentStates: filters.consentStates,
    },
  };
}

function normalizeDateRange(dateRange = {}) {
  return {
    from: typeof dateRange.from === 'string' ? dateRange.from : null,
    to: typeof dateRange.to === 'string' ? dateRange.to : null,
  };
}

function normalizeContactFilter(filter = {}) {
  return {
    required: Boolean(filter.required),
    verifiedOnly: Boolean(filter.verifiedOnly),
  };
}

function normalizeGeoFilter(geo = {}) {
  return {
    countries: uniqueStrings(geo.countries),
    regions: uniqueStrings(geo.regions),
  };
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
}

function nonNegativeInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(evaluateSegmentPlan({ filters: { sourceIds: ['legacy'], dateRange: { from: '2025-01-01', to: '2026-01-01' }, email: { required: true } }, counts: { estimatedTotal: 1000, suppressedCount: 25, countsReviewedAt: new Date().toISOString() } }), null, 2));
}
