import crypto from 'node:crypto';

const PASSWORD_ALGORITHM = 'sha256';
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24;
export const DEFAULT_ADMIN_EMAIL = 'admin@mehyarmedia.local';
export const DEFAULT_ADMIN_PASSWORD = 'change-me-before-production';

export const ROLES = Object.freeze({
  admin: Object.freeze([
    'dashboard:read',
    'users:manage',
    'audit:read',
    'command_center:read',
    'records:read',
    'records:write',
    'compliance:evaluate',
    'segments:evaluate',
    'system:health',
  ]),
  operator: Object.freeze(['dashboard:read', 'command_center:read', 'records:read']),
  viewer: Object.freeze(['dashboard:read']),
});

export class AuthStore {
  constructor({ auditLog = null, now = () => new Date() } = {}) {
    this.auditLog = auditLog;
    this.now = now;
    this.users = new Map();
    this.sessions = new Map();
  }

  createUser({ email, password, role = 'viewer', actorId = 'system' }) {
    if (!email) throw new Error('email is required');
    if (!password) throw new Error('password is required');
    if (!ROLES[role]) throw new Error(`unknown role: ${role}`);

    const normalizedEmail = email.trim().toLowerCase();
    if (this.users.has(normalizedEmail)) throw new Error('user already exists');

    const user = Object.freeze({
      id: `usr_${hash(normalizedEmail).slice(0, 12)}`,
      email: normalizedEmail,
      passwordHash: hash(password),
      role,
      permissions: ROLES[role],
      createdAt: this.now().toISOString(),
    });
    this.users.set(normalizedEmail, user);
    this.auditLog?.record({ actorId, action: 'auth.user.created', resourceType: 'user', resourceId: user.id, metadata: { role } });
    return publicUser(user);
  }

  login({ email, password, actorId = null, ttlMs = DEFAULT_SESSION_TTL_MS }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = this.users.get(normalizedEmail);
    if (!user || user.passwordHash !== hash(password || '')) {
      this.auditLog?.record({ actorId: actorId || (normalizedEmail ? `login_${hash(normalizedEmail).slice(0, 12)}` : 'anonymous'), action: 'auth.login.failed', resourceType: 'session', metadata: { identifierHash: normalizedEmail ? hash(normalizedEmail).slice(0, 12) : null } });
      return { ok: false, error: 'invalid credentials' };
    }

    const createdAt = this.now();
    const session = Object.freeze({
      id: `ses_${crypto.randomBytes(16).toString('hex')}`,
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
    });
    this.sessions.set(session.id, session);
    this.auditLog?.record({ actorId: user.id, action: 'auth.login.succeeded', resourceType: 'session', resourceId: null, metadata: { role: user.role } });
    return { ok: true, session, user: publicUser(user) };
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= this.now().getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  listUsers() {
    return [...this.users.values()].map(publicUser);
  }

  stats() {
    return {
      users: this.users.size,
      roles: Object.keys(ROLES).length,
      activeSessions: [...this.sessions.values()].filter((session) => Date.parse(session.expiresAt) > this.now().getTime()).length,
    };
  }
}

export function seedAdmin(authStore, { email = DEFAULT_ADMIN_EMAIL, password = DEFAULT_ADMIN_PASSWORD } = {}) {
  if (authStore.listUsers().some((user) => user.email === email)) return null;
  return authStore.createUser({ email, password, role: 'admin', actorId: 'bootstrap' });
}

function hash(value) {
  return crypto.createHash(PASSWORD_ALGORITHM).update(String(value)).digest('hex');
}

function publicUser(user) {
  return Object.freeze({ id: user.id, email: user.email, role: user.role, permissions: user.permissions, createdAt: user.createdAt });
}
