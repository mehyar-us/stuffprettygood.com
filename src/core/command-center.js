const ENTITY_CONFIG = Object.freeze({
  brands: {
    required: ['name', 'domain', 'vertical', 'type', 'status', 'senderIdentity', 'complianceUrls'],
    defaults: { status: 'planning', senderReadiness: 'not_ready', complianceUrls: {} },
  },
  domains: {
    required: ['domain', 'domainType', 'status', 'dnsStatus', 'sslStatus', 'senderReadiness'],
    defaults: { dnsStatus: 'unknown', sslStatus: 'unknown', senderReadiness: 'not_ready' },
  },
  lists: {
    required: ['name', 'safeQuerySource', 'channel'],
    defaults: { usableCount: 0, suppressionCount: 0, riskLevel: 'unknown', status: 'draft' },
  },
  segments: {
    required: ['name', 'safeQuerySource', 'channel', 'filters', 'riskTier'],
    defaults: { status: 'draft', suppressionOverlapCount: 0, previewLimit: 100, materializationAllowed: false },
  },
  campaigns: {
    required: ['name', 'brandId', 'channel', 'targetSegment'],
    defaults: { status: 'draft', suppressionStatus: 'pending', complianceStatus: 'pending', approvalStatus: 'draft_only' },
  },
  integrations: {
    required: ['name', 'kind', 'status'],
    defaults: { secretsStoredExternally: true, lastCheckedAt: null },
  },
  queryTemplates: {
    required: ['name', 'sourceSystem', 'purpose'],
    defaults: { readOnly: true, maxPreviewRows: 100, fullTablePullAllowed: false },
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
    if (this.records.get('brands').some((brand) => brand.domain === 'stuffprettygood.com')) return this.buildSummary();
    this.create('brands', {
      name: 'Mehyar Media CRM',
      domain: 'mehyarmedia.mehyar.us',
      vertical: 'crm-operations',
      type: 'internal_command_center',
      status: 'planning',
      senderIdentity: 'not-a-sending-brand',
      complianceUrls: { privacy: 'https://mehyarmedia.mehyar.us/privacy' },
      senderReadiness: 'not_a_sending_domain',
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
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'mehyarmedia.mehyar.us',
      domainType: 'crm',
      status: 'planned',
      dnsStatus: 'pending_hostinger_dns',
      sslStatus: 'pending_https',
      senderReadiness: 'not_a_sending_domain',
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'stuffprettygood.com',
      domainType: 'landing',
      status: 'planned',
      dnsStatus: 'pending_hostinger_dns',
      sslStatus: 'pending_https',
      senderReadiness: 'not_a_sending_domain',
    }, { actorId: 'system-seed' });
    this.create('domains', {
      domain: 'mail.stuffprettygood.com',
      domainType: 'sending',
      status: 'blocked',
      dnsStatus: 'not_configured',
      sslStatus: 'not_applicable',
      senderReadiness: 'blocked_until_suppression_and_compliance_approved',
    }, { actorId: 'system-seed' });
    this.create('integrations', {
      name: 'Legacy IONOS PostgreSQL',
      kind: 'legacy_postgresql_source',
      status: 'pending_credentials',
      secretsStoredExternally: true,
      readOnlyRequired: true,
    }, { actorId: 'system-seed' });
    return this.buildSummary();
  }

  create(entityType, input = {}, { actorId = 'anonymous' } = {}) {
    assertEntityType(entityType);
    const config = ENTITY_CONFIG[entityType];
    const normalized = normalizeEntity(entityType, { ...config.defaults, ...input });
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
      senderDomainSeparation: buildSenderDomainSeparation(this.records.get('domains')),
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

function normalizeEntity(entityType, record) {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  if (entityType === 'lists' && !normalized.safeQuerySource && normalized.source) normalized.safeQuerySource = normalized.source;
  if (entityType === 'campaigns') normalized.status = normalized.status || 'draft';
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
  if (entityType === 'campaigns' && record.status !== 'draft') violations.push('Phase 1 campaigns must be created as draft only');
  if (entityType === 'integrations' && record.secretsStoredExternally !== true) violations.push('integration secrets must be stored externally');
  if (entityType === 'queryTemplates') {
    if (record.readOnly !== true) violations.push('query templates must be read-only');
    if (record.fullTablePullAllowed === true) violations.push('full-table pulls are not allowed');
    if (record.maxPreviewRows > 100) violations.push('preview rows cannot exceed 100');
  }
  return violations;
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
