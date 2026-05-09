import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DATABASE_URL_KEYS = Object.freeze(['CRM_DATABASE_URL', 'DATABASE_URL']);
const IONOS_KEYS = Object.freeze([
  'IONOS_PSQL_HOST',
  'IONOS_PSQL_PORT',
  'IONOS_PSQL_DB',
  'IONOS_PSQL_USER',
  'IONOS_PSQL_PASS',
]);
const REQUIRED_TABLES = Object.freeze([
  'crm_users',
  'crm_roles',
  'crm_user_roles',
  'crm_sessions',
  'audit_logs',
  'brands',
  'domains',
  'campaigns',
  'lists',
  'segments',
  'suppressions',
  'integrations',
  'query_templates',
  'sync_jobs',
  'imported_lead_refs',
]);
const DEFAULT_MIGRATIONS = Object.freeze(['001_initial_crm_schema.sql']);

export async function collectDatabaseStatus({
  env = process.env,
  checkMigrations = defaultMigrationCheck,
  migrationFiles = DEFAULT_MIGRATIONS,
  requiredTables = REQUIRED_TABLES,
} = {}) {
  const configuredEnv = configuredDatabaseKeys(env);
  const configured = configuredEnv.length > 0;
  const target = sanitizedTarget(env);
  const migrationResult = configured
    ? await checkMigrations({ env, migrationFiles, requiredTables })
    : { applied: false, appliedCount: 0, pending: [...migrationFiles] };

  return sanitizeDatabaseStatus({
    status: configured ? 'configured' : 'not_configured',
    host: target.host,
    port: target.port,
    database: target.database,
    migrations: migrationResult.applied ? 'applied' : 'pending',
    appliedMigrations: Number.isFinite(migrationResult.appliedCount) ? migrationResult.appliedCount : 0,
    pendingMigrations: Array.isArray(migrationResult.pending) ? migrationResult.pending : [],
    configuredEnv,
  });
}

export function configuredDatabaseKeys(env = process.env) {
  const keys = [];
  for (const key of DATABASE_URL_KEYS) {
    if (hasValue(env[key])) keys.push(key);
  }

  if (IONOS_KEYS.some((key) => hasValue(env[key]))) {
    for (const key of IONOS_KEYS) {
      if (hasValue(env[key])) keys.push(key);
    }
  }

  return keys;
}

export function sanitizeDatabaseStatus(status = {}) {
  const allowed = {
    status: status.status === 'configured' ? 'configured' : 'not_configured',
    host: status.host || null,
    port: Number.isFinite(status.port) ? status.port : null,
    database: status.database || null,
    migrations: status.migrations === 'applied' ? 'applied' : 'pending',
    appliedMigrations: Number.isFinite(status.appliedMigrations) ? status.appliedMigrations : 0,
    pendingMigrations: Array.isArray(status.pendingMigrations) ? [...status.pendingMigrations] : [],
    configuredEnv: Array.isArray(status.configuredEnv) ? [...status.configuredEnv] : [],
  };

  return allowed;
}

function sanitizedTarget(env) {
  const urlValue = DATABASE_URL_KEYS.map((key) => env[key]).find(hasValue);
  if (urlValue) return sanitizedTargetFromUrl(urlValue);

  if (hasValue(env.IONOS_PSQL_HOST) || hasValue(env.IONOS_PSQL_DB) || hasValue(env.IONOS_PSQL_PORT)) {
    return {
      host: hasValue(env.IONOS_PSQL_HOST) ? env.IONOS_PSQL_HOST : null,
      port: parsePort(env.IONOS_PSQL_PORT),
      database: hasValue(env.IONOS_PSQL_DB) ? env.IONOS_PSQL_DB : null,
    };
  }

  return { host: null, port: null, database: null };
}

function sanitizedTargetFromUrl(value) {
  try {
    const parsed = new URL(value);
    return {
      host: parsed.hostname || null,
      port: parsePort(parsed.port),
      database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) || null : null,
    };
  } catch {
    return { host: 'configured', port: null, database: null };
  }
}

function parsePort(value) {
  if (!hasValue(value)) return null;
  const port = Number.parseInt(value, 10);
  return Number.isFinite(port) ? port : null;
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function defaultMigrationCheck({ env = process.env, migrationFiles = DEFAULT_MIGRATIONS, requiredTables = REQUIRED_TABLES } = {}) {
  const pgEnv = postgresEnv(env);
  if (!pgEnv) return { applied: false, appliedCount: 0, pending: [...migrationFiles] };

  const tableList = requiredTables.map((table) => `'${table.replaceAll("'", "''")}'`).join(',');
  const sql = `select count(*) from information_schema.tables where table_schema = 'public' and table_name in (${tableList});`;

  try {
    const { stdout } = await execFileAsync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      env: { ...process.env, ...pgEnv },
      timeout: 5000,
      maxBuffer: 32 * 1024,
    });
    const appliedCount = Number.parseInt(stdout.trim(), 10);
    const applied = Number.isFinite(appliedCount) && appliedCount >= requiredTables.length;
    return { applied, appliedCount: Number.isFinite(appliedCount) ? appliedCount : 0, pending: applied ? [] : [...migrationFiles] };
  } catch {
    return { applied: false, appliedCount: 0, pending: [...migrationFiles] };
  }
}

function postgresEnv(env) {
  const urlValue = DATABASE_URL_KEYS.map((key) => env[key]).find(hasValue);
  if (urlValue) {
    try {
      const parsed = new URL(urlValue);
      return {
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || '5432',
        PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
        PGUSER: decodeURIComponent(parsed.username || ''),
        PGPASSWORD: decodeURIComponent(parsed.password || ''),
      };
    } catch {
      return null;
    }
  }

  if (!hasValue(env.IONOS_PSQL_HOST) || !hasValue(env.IONOS_PSQL_DB)) return null;
  return {
    PGHOST: env.IONOS_PSQL_HOST,
    PGPORT: hasValue(env.IONOS_PSQL_PORT) ? env.IONOS_PSQL_PORT : '5432',
    PGDATABASE: env.IONOS_PSQL_DB,
    PGUSER: env.IONOS_PSQL_USER || '',
    PGPASSWORD: env.IONOS_PSQL_PASS || '',
  };
}
