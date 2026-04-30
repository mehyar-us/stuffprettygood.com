const ENTITY_CONFIG = Object.freeze({
  brands: {
    required: ['name', 'domain', 'vertical', 'type', 'status'],
    defaults: { status: 'planning', senderReadiness: 'not_ready', complianceUrls: [] },
  },
  domains: {
    required: ['domain', 'domainType', 'status'],
    defaults: { dnsStatus: 'unknown', sslStatus: 'unknown', senderReadiness: 'not_ready' },
  },
  lists: {
    required: ['name', 'source', 'channel'],
    defaults: { usableCount: 0, suppressionCount: 0, riskLevel: 'unknown', status: 'draft' },
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
      complianceUrls: [],
      senderReadiness: 'not_a_sending_domain',
    }, { actorId: 'system-seed' });
    this.create('brands', {
      name: 'Stuff Pretty Good',
      domain: 'stuffprettygood.com',
      vertical: 'affiliate-content',
      type: 'first_affiliate_site',
      status: 'planning',
      senderIdentity: 'no-send-phase-1',
      complianceUrls: ['https://stuffprettygood.com/privacy', 'https://stuffprettygood.com/unsubscribe'],
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
      const error = new Error(`invalid ${entityType} record`);
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
  const match = pathname.match(/^\/api\/(brands|domains|lists|campaigns|integrations|query-templates)$/);
  if (!match) return null;
  return match[1] === 'query-templates' ? 'queryTemplates' : match[1];
}

function assertEntityType(entityType) {
  if (!ENTITY_CONFIG[entityType]) throw new Error(`unknown entity type: ${entityType}`);
}

function normalizeEntity(entityType, record) {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  if (entityType === 'campaigns') normalized.status = normalized.status || 'draft';
  if (entityType === 'queryTemplates') {
    normalized.readOnly = normalized.readOnly !== false;
    normalized.fullTablePullAllowed = false;
    normalized.maxPreviewRows = Math.min(nonNegativeInteger(normalized.maxPreviewRows || 100), 100);
  }
  return normalized;
}

function validateEntity(entityType, record) {
  const violations = [];
  if (entityType === 'domains' && !SAFE_DOMAIN_TYPES.includes(record.domainType)) violations.push(`domainType must be one of ${SAFE_DOMAIN_TYPES.join(', ')}`);
  if ((entityType === 'lists' || entityType === 'campaigns') && !SAFE_CHANNELS.includes(record.channel)) violations.push('channel must be email or sms');
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
