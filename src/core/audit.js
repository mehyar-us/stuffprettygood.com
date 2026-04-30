const DEFAULT_MAX_EVENTS = 500;

export class AuditLog {
  constructor({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
    this.maxEvents = maxEvents;
    this.events = [];
  }

  record({ actorId, action, resourceType, resourceId = null, metadata = {}, now = new Date().toISOString() }) {
    if (!action) throw new Error('audit action is required');
    if (!resourceType) throw new Error('audit resourceType is required');

    const event = Object.freeze({
      id: `audit_${this.events.length + 1}_${Date.parse(now) || Date.now()}`,
      actorId: actorId || 'system',
      action,
      resourceType,
      resourceId,
      metadata: Object.freeze({ ...metadata }),
      createdAt: now,
    });

    this.events = Object.freeze([...this.events, event].slice(-this.maxEvents));
    return event;
  }

  list({ limit = 50, resourceType = null } = {}) {
    const filtered = resourceType ? this.events.filter((event) => event.resourceType === resourceType) : this.events;
    return filtered.slice(-limit).reverse();
  }

  count() {
    return this.events.length;
  }
}

export const auditLog = new AuditLog();
