import { createHash } from 'node:crypto';

export const SUPPRESSION_CATEGORIES = Object.freeze([
  'global_unsubscribe',
  'brand_unsubscribe',
  'sms_stop',
  'spam_complaint',
  'hard_bounce',
  'soft_bounce_cooldown',
  'legal_suppression',
  'manual_suppression',
  'invalid_contact_point',
  'source_hold',
  'prohibited_source',
  'provider_warning_hold',
]);

const EMAIL_SUPPRESSION_CATEGORIES = new Set([
  'global_unsubscribe',
  'brand_unsubscribe',
  'spam_complaint',
  'hard_bounce',
  'soft_bounce_cooldown',
  'invalid_contact_point',
]);

const CONTACT_SUPPRESSION_CATEGORIES = new Set(['legal_suppression', 'manual_suppression']);
const SOURCE_SUPPRESSION_CATEGORIES = new Set(['source_hold', 'prohibited_source']);
const BRAND_SUPPRESSION_CATEGORIES = new Set(['provider_warning_hold']);

export class SuppressionStore {
  constructor({ auditLog = null, now = () => new Date().toISOString() } = {}) {
    this.auditLog = auditLog;
    this.now = now;
    this.records = [];
  }

  writeSuppression(input = {}) {
    const record = normalizeSuppressionRecord(input, this.now());
    this.records.push(Object.freeze(record));
    this.auditLog?.record({
      actorId: record.actorId,
      action: 'suppression.write',
      resourceType: 'suppression',
      resourceId: record.id,
      metadata: {
        category: record.category,
        brandId: record.brandId,
        scope: record.scope,
        channel: record.channel,
        sourceId: record.sourceId,
      },
    });
    return record;
  }

  recordEmailUnsubscribe({ token, brandId, scope = 'brand_and_global', actorId = 'public-unsubscribe', requestId = null } = {}) {
    const contactHash = this.contactHashFromToken(token);
    const normalizedBrandId = String(brandId || '').trim();
    if (!normalizedBrandId) throw validationError('brandId is required');

    const categories = scope === 'global' ? ['global_unsubscribe'] : ['brand_unsubscribe', 'global_unsubscribe'];
    const records = categories.map((category) => this.writeSuppression({
      category,
      brandId: category === 'brand_unsubscribe' ? normalizedBrandId : null,
      scope: category === 'brand_unsubscribe' ? 'brand' : 'global',
      channel: 'email',
      contactHash,
      emailHash: contactHash,
      reason: 'email_unsubscribe_request',
      actorId,
      requestId,
    }));

    this.auditLog?.record({
      actorId,
      action: 'unsubscribe.email.recorded',
      resourceType: 'unsubscribe',
      resourceId: contactHash,
      metadata: {
        brandId: normalizedBrandId,
        scope,
        categories,
        requestId,
      },
    });

    return {
      ok: true,
      contactHash,
      categories,
      records,
    };
  }

  recordSmsStop({ token, brandId = null, actorId = 'public-sms-stop', requestId = null } = {}) {
    const contactHash = this.contactHashFromToken(token);
    const category = 'sms_stop';
    const record = this.writeSuppression({
      category,
      brandId,
      scope: 'global',
      channel: 'sms',
      contactHash,
      phoneHash: contactHash,
      reason: 'sms_stop_request',
      actorId,
      requestId,
    });

    this.auditLog?.record({
      actorId,
      action: 'sms_stop.recorded',
      resourceType: 'suppression',
      resourceId: contactHash,
      metadata: {
        brandId: stringOrNull(brandId),
        categories: [category],
        requestId,
      },
    });

    return {
      ok: true,
      contactHash,
      categories: [category],
      records: [record],
    };
  }

  list() {
    return [...this.records];
  }

  contactHashFromToken(token) {
    return contactHashFromToken(token);
  }
}

export function buildSuppressionToken(seed) {
  const digest = createHash('sha256').update(String(seed || '')).digest('base64url');
  return `unsub_${digest.slice(0, 32)}`;
}

export function contactHashFromToken(token) {
  const normalized = normalizeOpaqueToken(token);
  return `contact_${createHash('sha256').update(normalized).digest('hex')}`;
}

export function evaluateContactEligibility(contact = {}, { suppressionStore, brandId = contact.brandId || null, now = new Date().toISOString() } = {}) {
  const records = typeof suppressionStore?.list === 'function' ? suppressionStore.list() : [];
  const matchedSuppressions = records.filter((record) => suppressionMatchesContact(record, contact, brandId, now));
  return {
    eligible: matchedSuppressions.length === 0,
    matchedSuppressions: matchedSuppressions.map((record) => ({
      id: record.id,
      category: record.category,
      brandId: record.brandId,
      scope: record.scope,
      channel: record.channel,
      sourceId: record.sourceId,
      expiresAt: record.expiresAt,
    })),
  };
}

function normalizeSuppressionRecord(input, now) {
  const category = String(input.category || '').trim();
  if (!SUPPRESSION_CATEGORIES.includes(category)) throw validationError(`unknown suppression category: ${category}`);

  const record = {
    id: input.id || `sup_${createHash('sha256').update(`${category}:${now}:${JSON.stringify(safeIdentityFields(input))}`).digest('hex').slice(0, 24)}`,
    category,
    scope: input.scope || defaultScopeForCategory(category),
    channel: input.channel || defaultChannelForCategory(category),
    brandId: stringOrNull(input.brandId),
    contactHash: stringOrNull(input.contactHash),
    emailHash: stringOrNull(input.emailHash),
    phoneHash: stringOrNull(input.phoneHash),
    sourceId: stringOrNull(input.sourceId),
    reason: stringOrNull(input.reason),
    actorId: input.actorId || 'system',
    requestId: stringOrNull(input.requestId),
    expiresAt: stringOrNull(input.expiresAt),
    createdAt: now,
  };

  if (EMAIL_SUPPRESSION_CATEGORIES.has(category) && !record.emailHash && !record.contactHash) {
    throw validationError(`${category} requires emailHash or contactHash`);
  }
  if (category === 'sms_stop' && !record.phoneHash && !record.contactHash) {
    throw validationError('sms_stop requires phoneHash or contactHash');
  }
  if (CONTACT_SUPPRESSION_CATEGORIES.has(category) && !record.contactHash) {
    throw validationError(`${category} requires contactHash`);
  }
  if (SOURCE_SUPPRESSION_CATEGORIES.has(category) && !record.sourceId) {
    throw validationError(`${category} requires sourceId`);
  }
  if (BRAND_SUPPRESSION_CATEGORIES.has(category) && !record.brandId) {
    throw validationError(`${category} requires brandId`);
  }
  if (category === 'brand_unsubscribe' && !record.brandId) {
    throw validationError('brand_unsubscribe requires brandId');
  }

  return record;
}

function suppressionMatchesContact(record, contact, brandId, now) {
  if (record.expiresAt && record.expiresAt <= now) return false;
  if (record.brandId && brandId && record.brandId !== brandId) return false;

  if (EMAIL_SUPPRESSION_CATEGORIES.has(record.category)) {
    return sameHash(record.emailHash, contact.emailHash) || sameHash(record.contactHash, contact.contactHash);
  }
  if (record.category === 'sms_stop') {
    return sameHash(record.phoneHash, contact.phoneHash) || sameHash(record.contactHash, contact.contactHash);
  }
  if (CONTACT_SUPPRESSION_CATEGORIES.has(record.category)) {
    return sameHash(record.contactHash, contact.contactHash);
  }
  if (SOURCE_SUPPRESSION_CATEGORIES.has(record.category)) {
    return Boolean(record.sourceId && record.sourceId === contact.sourceId);
  }
  if (BRAND_SUPPRESSION_CATEGORIES.has(record.category)) {
    return Boolean(record.brandId && record.brandId === brandId);
  }
  return false;
}

function normalizeOpaqueToken(token) {
  const normalized = String(token || '').trim();
  if (!/^unsub_[A-Za-z0-9_-]{24,}$/.test(normalized)) throw validationError('valid opaque unsubscribe token is required');
  return normalized;
}

function defaultScopeForCategory(category) {
  if (['global_unsubscribe', 'sms_stop', 'spam_complaint', 'hard_bounce', 'legal_suppression', 'manual_suppression'].includes(category)) return 'global';
  if (category === 'brand_unsubscribe' || category === 'provider_warning_hold') return 'brand';
  if (category === 'source_hold' || category === 'prohibited_source') return 'source';
  return 'contact';
}

function defaultChannelForCategory(category) {
  if (category === 'sms_stop') return 'sms';
  if (EMAIL_SUPPRESSION_CATEGORIES.has(category)) return 'email';
  return 'all';
}

function sameHash(left, right) {
  return Boolean(left && right && left === right);
}

function stringOrNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function safeIdentityFields(input) {
  return {
    category: input.category,
    brandId: input.brandId,
    contactHash: input.contactHash,
    emailHash: input.emailHash,
    phoneHash: input.phoneHash,
    sourceId: input.sourceId,
    expiresAt: input.expiresAt,
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}
