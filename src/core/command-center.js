import {
  REQUIRED_SUPPRESSION_CATEGORIES,
  validateComplianceApproval,
  validateSuppressionApproval,
} from '../compliance/gates.js';

const PILOT_BRAND_DOMAIN = 'stuffprettygood.com';
const STRUCTURAL_BOOT_SOURCE_REF = 'system:structural-boot';
const STRUCTURAL_BOOT_ARTIFACT_REF = 'docs/crm-2026-truth-first-revenue-os-vision.md';
const PROVENANCE_STATES = Object.freeze(['verified', 'pending', 'simulated', 'blocked', 'missing']);
const PROVENANCE_REQUIRED_ENTITY_TYPES = Object.freeze(['lists', 'segments', 'campaigns', 'queryTemplates']);
const SAFE_CAMPAIGN_STATUSES = Object.freeze(['draft', 'evidence-needed', 'compliance-review', 'Boss-approval-needed', 'ready-for-dry-run', 'blocked']);

const ENTITY_CONFIG = Object.freeze({
  brands: {
    required: ['name', 'domain', 'vertical', 'type', 'status', 'senderIdentity', 'complianceUrls'],
    defaults: { status: 'planning', senderReadiness: 'not_ready', complianceUrls: {}, provenance_state: 'pending' },
  },
  domains: {
    required: ['domain', 'domainType', 'status', 'dnsStatus', 'sslStatus', 'senderReadiness'],
    defaults: { dnsStatus: 'unknown', sslStatus: 'unknown', senderReadiness: 'not_ready', provenance_state: 'pending' },
  },
  lists: {
    required: ['name', 'safeQuerySource', 'channel'],
    defaults: { usableCount: 0, suppressionCount: 0, riskLevel: 'unknown', status: 'draft', provenance_state: 'pending' },
  },
  segments: {
    required: ['name', 'safeQuerySource', 'channel', 'filters', 'riskTier'],
    defaults: { status: 'draft', suppressionOverlapCount: 0, previewLimit: 100, materializationAllowed: false, provenance_state: 'pending' },
  },
  campaigns: {
    required: ['name', 'brandId', 'channel', 'targetSegment'],
    defaults: { status: 'draft', suppressionStatus: 'pending', complianceStatus: 'pending', approvalStatus: 'draft_only', provenance_state: 'pending' },
  },
  integrations: {
    required: ['name', 'kind', 'status'],
    defaults: { secretsStoredExternally: true, lastCheckedAt: null, provenance_state: 'pending' },
  },
  queryTemplates: {
    required: ['name', 'sourceSystem', 'purpose'],
    defaults: { readOnly: true, maxPreviewRows: 100, fullTablePullAllowed: false, provenance_state: 'pending' },
  },
});

const SAFE_DOMAIN_TYPES = Object.freeze(['crm', 'landing', 'sending', 'tracking']);
const SAFE_CHANNELS = Object.freeze(['email', 'sms']);
const SAFE_RISK_LEVELS = Object.freeze(['unknown', 'low', 'medium', 'high', 'blocked']);
const REQUIRED_SEGMENT_FILTERS = Object.freeze([
  'sourceIds',
  'dateRange',
  'email',
  'phone',
  'geo',
  'consentStates',
  'excludeUnsubscribed',
  'excludeSuppressed',
  'riskTier',
]);

export class CommandCenterStore {
  constructor({ auditLog = null, now = () => new Date().toISOString() } = {}) {
    this.auditLog = auditLog;
    this.now = now;
    this.records = new Map(Object.keys(ENTITY_CONFIG).map((key) => [key, []]));
    this.legacySource = {
      status: 'not_configured',
      readOnly: true,
      destructiveQueriesAllowed: false,
      fullTablePullsAllowed: false,
      maxPreviewRows: 100,
      inspectedSchemas: [],
      tables: [],
      lastConnectionTest: null,
    };
  }

  seedFirstBrand() {
    if (this.records.get('brands').some((brand) => brand.domain === 'stuffprettygood.com')) {
      return this.buildSummary();
    }
    this.create('brands', {
      name: 'Mehyar Media CRM',
      domain: 'mehyarmedia.mehyar.us',
      vertical: 'crm-operations',
      type: 'internal_command_center',
      status: 'planning',
      senderIdentity: 'not-a-sending-brand',
      complianceUrls: { privacy: 'https://mehyarmedia.mehyar.us/privacy' },
      senderReadiness: 'not_a_sending_domain',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Verify CRM DNS/HTTPS and keep this brand as an internal command-center placeholder only.',
    }, { actorId: 'system-seed' });
    this.create('brands', {
      name: 'Stuff Pretty Good',
      domain: 'stuffprettygood.com',
      vertical: 'affiliate-content',
      type: 'first_affiliate_site',
      status: 'planning',
      senderIdentity: 'no-send-phase-1',
      complianceUrls: { privacy: 'https://stuffprettygood.com/privacy', unsubscribe: 'https://stuffprettygood.com/unsubscribe' },
      senderReadiness: 'blocked_until_compliance_approved',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Verify SPG public compliance pages and connect monetized source artifacts before revenue actions.',
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'mehyarmedia.mehyar.us',
      domainType: 'crm',
      status: 'planned',
      dnsStatus: 'pending_hostinger_dns',
      sslStatus: 'pending_https',
      senderReadiness: 'not_a_sending_domain',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Verify CRM DNS and HTTPS; keep blocked from sending use.',
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'stuffprettygood.com',
      domainType: 'landing',
      status: 'planned',
      dnsStatus: 'pending_hostinger_dns',
      sslStatus: 'pending_https',
      senderReadiness: 'not_a_sending_domain',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Connect landing domain and verify public compliance pages before publishing offers.',
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'mail.stuffprettygood.com',
      domainType: 'sending',
      status: 'blocked',
      dnsStatus: 'not_configured',
      sslStatus: 'not_applicable',
      senderReadiness: 'blocked_until_suppression_and_compliance_approved',
      provenance_state: 'blocked',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Keep sending domain blocked until suppression, compliance, DNS, and Boss approval gates pass.',
    }, { actorId: 'system-seed' });
    this.create('integrations', {
      name: 'Legacy IONOS PostgreSQL',
      kind: 'legacy_postgresql_source',
      status: 'pending_credentials',
      secretsStoredExternally: true,
      readOnlyRequired: true,
      provenance_state: 'blocked',
      source_ref: STRUCTURAL_BOOT_SOURCE_REF,
      artifact_refs: [STRUCTURAL_BOOT_ARTIFACT_REF],
      next_action: 'Configure read-only credentials by environment variable name and attach consent/suppression classification before audience use.',
    }, { actorId: 'system-seed' });
    return this.buildSummary();
  }

  create(entityType, input = {}, { actorId = 'anonymous' } = {}) {
    assertEntityType(entityType);
    const config = ENTITY_CONFIG[entityType];
    const normalized = normalizeEntity(entityType, { ...config.defaults, ...input }, { actorId });
    const missing = config.required.filter((field) => !normalized[field]);
    const violations = validateEntity(entityType, normalized);
    if (missing.length || violations.length) {
      const error = new Error(`invalid ${entityType} record${violations.length ? `: ${violations.join('; ')}` : ''}`);
      error.statusCode = 422;
      error.details = { missing, violations };
      throw error;
    }

    const record = Object.freeze({
      id: normalized.id || createId(entityType),
      ...normalized,
      createdAt: normalized.createdAt || this.now(),
      updatedAt: this.now(),
    });
    this.records.get(entityType).push(record);
    this.auditLog?.record({ actorId, action: `${entityType}.created`, resourceType: entityType, resourceId: record.id });
    return record;
  }

  list(entityType) {
    assertEntityType(entityType);
    return [...this.records.get(entityType)];
  }

  get(entityType, id) {
    assertEntityType(entityType);
    return this.records.get(entityType).find((record) => record.id === id) || null;
  }

  counts() {
    return Object.fromEntries([...this.records.entries()].map(([key, records]) => [key, records.length]));
  }

  inspectLegacySource({ schemas = [], tables = [], connectionStatus = 'not_configured', actorId = 'anonymous' } = {}) {
    const inspectedSchemas = uniqueStrings(schemas);
    const safeTables = tables.map((table) => ({
      schema: String(table.schema || 'public'),
      table: String(table.table || table.name || ''),
      estimatedRows: nonNegativeInteger(table.estimatedRows),
      previewAllowed: table.previewAllowed !== false,
    })).filter((table) => table.table);

    this.legacySource = Object.freeze({
      ...this.legacySource,
      status: connectionStatus,
      inspectedSchemas,
      tables: safeTables,
      lastConnectionTest: this.now(),
    });
    this.auditLog?.record({ actorId, action: 'legacy_source.inspected', resourceType: 'legacy_source', metadata: { connectionStatus, tableCount: safeTables.length } });
    return this.legacySource;
  }

  buildSummary() {
    const counts = this.counts();
    return {
      phase: 'phase_1_control_room',
      massSendingEnabled: false,
      counts,
      firstBrandReady: this.records.get('brands').some((brand) => brand.domain === 'stuffprettygood.com'),
      crmDomain: this.records.get('domains').find((domain) => domain.domainType === 'crm') || null,
      legacySource: this.legacySource,
      moduleReadiness: buildModuleReadiness(),
      pilotReadiness: buildPilotReadiness(this.records),
      senderDomainSeparation: buildSenderDomainSeparation(this.records.get('domains')),
      productionSeedPolicy: {
        structuralOnly: true,
        allowedSeedEntityTypes: ['brands', 'domains', 'integrations'],
        prohibitedSeedEntityTypes: [...PROVENANCE_REQUIRED_ENTITY_TYPES],
        source_ref: STRUCTURAL_BOOT_SOURCE_REF,
        artifact_ref: STRUCTURAL_BOOT_ARTIFACT_REF,
      },
      guardrails: [
        'campaigns remain draft-only until suppression and compliance approvals pass',
        'legacy IONOS access is read-only with bounded previews only',
        'secrets must be injected through environment variables or VPS secret storage',
        'CRM domain is not a marketing sending domain',
      ],
    };
  }
}

export function routeEntityFromPath(pathname) {
  const match = pathname.match(/^\/api\/(brands|domains|lists|segments|campaigns|integrations|query-templates)$/);
  if (!match) return null;
  return match[1] === 'query-templates' ? 'queryTemplates' : match[1];
}

function assertEntityType(entityType) {
  if (!ENTITY_CONFIG[entityType]) throw new Error(`unknown entity type: ${entityType}`);
}

function normalizeEntity(entityType, record, { actorId = 'anonymous' } = {}) {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  normalizeProvenance(entityType, normalized, actorId);
  if (entityType === 'lists' && !normalized.safeQuerySource && normalized.source) normalized.safeQuerySource = normalized.source;
  if (entityType === 'campaigns') normalized.status = normalizeCampaignStatus(normalized.status || 'draft');
  if (entityType === 'segments') {
    normalized.filters = normalizeSegmentFilters(normalized.filters || {});
    normalized.riskTier = normalized.riskTier || 'unknown';
  }
  if (entityType === 'queryTemplates') {
    normalized.readOnly = normalized.readOnly !== false;
    normalized.fullTablePullAllowed = false;
    normalized.maxPreviewRows = Math.min(nonNegativeInteger(normalized.maxPreviewRows || 100), 100);
  }
  return normalized;
}

function validateEntity(entityType, record) {
  const violations = [];
  if (!PROVENANCE_STATES.includes(record.provenance_state)) violations.push(`provenance_state must be one of ${PROVENANCE_STATES.join(', ')}`);
  if (PROVENANCE_REQUIRED_ENTITY_TYPES.includes(entityType)) {
    if (!record.source_ref) violations.push('source_ref is required for non-structural CRM records');
    if (!Array.isArray(record.artifact_refs) || record.artifact_refs.length === 0) violations.push('artifact_refs are required for non-structural CRM records');
    if (!record.next_action) violations.push('next_action is required for provenance-aware CRM records');
  }
  if (entityType === 'brands') {
    if (!isObject(record.senderIdentity) && typeof record.senderIdentity !== 'string') violations.push('senderIdentity is required');
    if (!validComplianceUrls(record.complianceUrls)) violations.push('complianceUrls must include at least privacy or unsubscribe URL metadata');
  }
  if (entityType === 'domains') {
    if (!SAFE_DOMAIN_TYPES.includes(record.domainType)) violations.push(`domainType must be one of ${SAFE_DOMAIN_TYPES.join(', ')}`);
    if (record.domainType === 'crm' && !['not_a_sending_domain', 'not_applicable', 'blocked'].includes(record.senderReadiness)) violations.push('CRM domains cannot be sender-ready');
  }
  if ((entityType === 'lists' || entityType === 'segments' || entityType === 'campaigns') && !SAFE_CHANNELS.includes(record.channel)) violations.push('channel must be email or sms');
  if (entityType === 'lists') {
    if (!isSafeQuerySource(record.safeQuerySource)) violations.push('safeQuerySource is required and must reference an approved safe query source');
    if (!SAFE_RISK_LEVELS.includes(record.riskLevel)) violations.push(`riskLevel must be one of ${SAFE_RISK_LEVELS.join(', ')}`);
  }
  if (entityType === 'segments') {
    if (!isSafeQuerySource(record.safeQuerySource)) violations.push('safeQuerySource is required and must reference an approved safe query source');
    if (!SAFE_RISK_LEVELS.includes(record.riskTier)) violations.push(`riskTier must be one of ${SAFE_RISK_LEVELS.join(', ')}`);
    if (record.filters.sourceIds.length === 0) violations.push('segments require at least one source filter');
    if (!record.filters.dateRange.from || !record.filters.dateRange.to) violations.push('segments require bounded dateRange filters');
    if (record.channel === 'email' && record.filters.email.required !== true) violations.push('email segments require email.required=true');
    if (record.channel === 'sms' && record.filters.phone.required !== true) violations.push('SMS segments require phone.required=true');
    if (record.filters.excludeUnsubscribed !== true) violations.push('segments must exclude unsubscribed records');
    if (record.filters.excludeSuppressed !== true) violations.push('segments must exclude suppressed records');
  }
  if (entityType === 'campaigns' && !SAFE_CAMPAIGN_STATUSES.includes(record.status)) violations.push(`campaign status must be one of ${SAFE_CAMPAIGN_STATUSES.join(', ')}`);
  if (entityType === 'integrations' && record.secretsStoredExternally !== true) violations.push('integration secrets must be stored externally');
  if (entityType === 'queryTemplates') {
    if (record.readOnly !== true) violations.push('query templates must be read-only');
    if (record.fullTablePullAllowed === true) violations.push('full-table pulls are not allowed');
    if (record.maxPreviewRows > 100) violations.push('preview rows cannot exceed 100');
  }
  return violations;
}

function normalizeProvenance(entityType, record, actorId) {
  record.provenance_state = PROVENANCE_STATES.includes(record.provenance_state) ? record.provenance_state : 'pending';
  record.source_ref = record.source_ref || record.sourceRef || null;
  record.artifact_refs = normalizeRefs(record.artifact_refs || record.artifactRefs || record.artifact_ref || record.artifactRef || []);
  record.next_action = record.next_action || record.nextAction || null;

  if (record.source_ref === STRUCTURAL_BOOT_SOURCE_REF && record.artifact_refs.length === 0) {
    record.artifact_refs = [STRUCTURAL_BOOT_ARTIFACT_REF];
  }

  if (PROVENANCE_REQUIRED_ENTITY_TYPES.includes(entityType)) {
    if (!record.source_ref) record.source_ref = `operator:${cleanActorId(actorId)}`;
    if (record.artifact_refs.length === 0) record.artifact_refs = ['audit-log:operator-entry'];
    if (!record.next_action) record.next_action = 'Attach verified source artifact, consent proof, and suppression clearance before production use.';
    if (record.provenance_state === 'verified' && (!record.source_ref || record.artifact_refs.length === 0)) record.provenance_state = 'pending';
  }
}

function normalizeCampaignStatus(status) {
  const statusMap = {
    review: 'compliance-review',
    remediation: 'evidence-needed',
    future_pilot_approved: 'ready-for-dry-run',
    paused: 'blocked',
    cancelled: 'blocked',
  };
  return statusMap[status] || status || 'draft';
}

function cleanActorId(actorId) {
  return String(actorId || 'anonymous').replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 80) || 'anonymous';
}

function normalizeRefs(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => String(value || '').trim()).filter(Boolean))];
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
}

function nonNegativeInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function buildModuleReadiness() {
  return {
    brandManager: {
      requiredFields: ['name', 'domain', 'vertical', 'type', 'status', 'senderIdentity', 'complianceUrls'],
      workflow: ['create brand', 'attach compliance URLs', 'review sender identity', 'audit changes'],
    },
    domainManager: {
      requiredFields: ['domain', 'domainType', 'status', 'dnsStatus', 'sslStatus', 'senderReadiness'],
      workflow: ['inventory CRM/landing/sending/tracking domains', 'verify DNS', 'verify SSL', 'block sender readiness until compliance gates pass'],
    },
    listManager: {
      requiredFields: ['name', 'safeQuerySource', 'channel', 'usableCount', 'suppressionCount', 'riskLevel'],
      workflow: ['select approved safe query source', 'record usable count', 'record suppression count', 'assign risk level before activation'],
    },
    segmentBuilder: {
      requiredFilters: [...REQUIRED_SEGMENT_FILTERS],
      workflow: ['choose source/date/contact/geo/consent filters', 'exclude unsubscribes', 'exclude suppressions', 'review risk before materialization'],
    },
  };
}

function buildPilotReadiness(records) {
  const brands = records.get('brands') || [];
  const domains = records.get('domains') || [];
  const segments = records.get('segments') || [];
  const campaigns = records.get('campaigns') || [];

  const brand = brands.find((candidate) => candidate.domain === PILOT_BRAND_DOMAIN) || null;
  const landingDomain = domains.find((domain) => domain.domain === PILOT_BRAND_DOMAIN) || null;
  const sendingDomain = domains.find((domain) => domain.domainType === 'sending' && domain.domain.endsWith(PILOT_BRAND_DOMAIN)) || null;
  const pilotCampaign = campaigns.find((campaign) => campaign.brandId === brand?.id || campaign.brandDomain === PILOT_BRAND_DOMAIN) || null;
  const approvedSegment = segments.find((segment) => ['approved', 'ready', 'materialized'].includes(segment.status) && segment.materializationAllowed === true) || null;
  const suppression = validateSuppressionApproval(pilotCampaign?.suppressionApproval);
  const compliance = validateComplianceApproval(pilotCampaign?.complianceApproval, pilotCampaign || { channel: 'email' });
  const senderDomainReady = sendingDomain?.senderReadiness === 'ready' && sendingDomain?.status === 'active';
  const approvalReady = pilotCampaign?.approvalStatus === 'approved';

  const gateFailures = [
    ...(!brand ? ['pilot brand record missing'] : []),
    ...(!approvedSegment ? ['pilot segment is not approved/materialized'] : []),
    ...suppression.reasons.map((reason) => `suppression: ${reason}`),
    ...compliance.reasons.map((reason) => `compliance: ${reason}`),
    ...(!senderDomainReady ? ['sender/domain readiness is blocked'] : []),
    ...(!approvalReady ? ['Boss/operator approval is not granted'] : []),
  ];
  const allGatesPassed = gateFailures.length === 0;

  return {
    brandDomain: PILOT_BRAND_DOMAIN,
    overallStatus: allGatesPassed ? 'ready_for_reviewed_export' : 'blocked',
    allGatesPassed,
    segment: {
      status: approvedSegment ? 'ready' : 'not_ready',
      segmentId: approvedSegment?.id || null,
      materializationAllowed: Boolean(approvedSegment?.materializationAllowed),
      reason: approvedSegment ? null : 'no approved/materialized pilot segment is available',
    },
    suppression: {
      status: suppression.ok ? 'approved' : 'pending_approval',
      ok: suppression.ok,
      requiredCategories: [...REQUIRED_SUPPRESSION_CATEGORIES],
      missingOrBlockingReasons: suppression.reasons,
    },
    compliance: {
      status: compliance.ok ? 'approved' : 'pending_approval',
      ok: compliance.ok,
      requiredChecks: ['legal_basis', 'sender_identity', 'unsubscribe_url_or_sms_stop', 'unresolved_findings_clear'],
      missingOrBlockingReasons: compliance.reasons,
    },
    senderDomain: {
      status: senderDomainReady ? 'ready' : 'blocked',
      landingDomain: landingDomain?.domain || null,
      sendingDomain: sendingDomain?.domain || null,
      senderReadiness: sendingDomain?.senderReadiness || 'not_configured',
      reason: senderDomainReady ? null : 'sending domain is not active and sender-ready',
    },
    approval: {
      status: approvalReady ? 'approved' : 'not_requested',
      campaignId: pilotCampaign?.id || null,
      campaignStatus: pilotCampaign?.status || 'not_created',
    },
    blockedActions: {
      send: true,
      export: !allGatesPassed,
      providerPush: !allGatesPassed,
      reasons: [
        'mass sending is disabled in Phase 1',
        ...(!suppression.ok ? ['pilot requires approved suppression review'] : []),
        ...(!compliance.ok ? ['pilot requires approved compliance review'] : []),
        ...(!approvedSegment ? ['pilot requires approved segment readiness'] : []),
        ...(!senderDomainReady ? ['pilot requires sender/domain readiness'] : []),
        ...(!approvalReady ? ['pilot requires explicit approval'] : []),
      ],
    },
    gateFailures,
  };
}

function buildSenderDomainSeparation(domains) {
  const crmDomain = domains.find((domain) => domain.domainType === 'crm') || null;
  const sendingDomains = domains.filter((domain) => domain.domainType === 'sending');
  return {
    crmDomainUsedForSending: Boolean(crmDomain && crmDomain.senderReadiness === 'ready'),
    crmDomain,
    sendingDomains,
  };
}

function normalizeSegmentFilters(filters) {
  return {
    sourceIds: uniqueStrings(filters.sourceIds),
    dateRange: {
      from: typeof filters.dateRange?.from === 'string' ? filters.dateRange.from : null,
      to: typeof filters.dateRange?.to === 'string' ? filters.dateRange.to : null,
    },
    email: { required: Boolean(filters.email?.required), verifiedOnly: Boolean(filters.email?.verifiedOnly) },
    phone: { required: Boolean(filters.phone?.required), verifiedOnly: Boolean(filters.phone?.verifiedOnly) },
    geo: {
      countries: uniqueStrings(filters.geo?.countries),
      regions: uniqueStrings(filters.geo?.regions),
    },
    consentStates: uniqueStrings(filters.consentStates),
    excludeUnsubscribed: filters.excludeUnsubscribed === true,
    excludeSuppressed: filters.excludeSuppressed === true,
  };
}

function validComplianceUrls(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!isObject(value)) return false;
  return Boolean(value.privacy || value.unsubscribe || value.terms);
}

function isSafeQuerySource(value) {
  const source = String(value || '');
  return source.startsWith('query-template:') || source.startsWith('safe-query-');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
