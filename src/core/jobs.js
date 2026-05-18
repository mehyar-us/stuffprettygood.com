import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_STORE_PATH = new URL('../../data/crm-job-runs.json', import.meta.url);
const DEFAULT_WORKDIR = new URL('../..', import.meta.url).pathname;
const MAX_LOG_CHARS = 12_000;
const SECRET_PATTERN = /(api[_-]?key|token|secret|password|pass|bearer|authorization)\s*[:=]\s*[^\s"']+/gi;

export const DEFAULT_JOB_DEFINITIONS = Object.freeze([
  {
    job_id: 'daily-pull-everything',
    label: 'Daily pull everything',
    owner: 'devops',
    command_argv: ['npm', 'run', 'daily:pull:everything'],
    schedule: '06:00 America/New_York',
    description: 'Runs SPG trends/RSS/monetized ingest, Opportunity Finder collectors, QA/tests, and safe Hostinger deploy gate.',
    expected_artifact: 'data/daily-pull/latest.json',
    env_keys: ['SAM_GOV_API_KEY or SAM_API_KEY', 'SERP_API_KEY', 'SKIMLINKS_API_KEY or STAY22_API_KEY', 'CRM_AMAZON_ASSOCIATES_TAG'],
    side_effects: ['internal collection', 'static build', 'QA', 'approved SPG deploy only after tests'],
  },
  {
    job_id: 'opportunities-collect',
    label: 'Opportunity Finder collect',
    owner: 'scout/dataeng',
    command_argv: ['npm', 'run', 'opportunities:collect'],
    schedule: 'manual / daily bundle',
    description: 'Pulls SAM.gov, USAspending, Grants.gov, RSS, job/posting demand, and affiliate/source opportunity signals into sanitized artifacts.',
    expected_artifact: 'data/opportunity-desk/opportunities.json',
    env_keys: ['SAM_GOV_API_KEY or SAM_API_KEY'],
    side_effects: ['internal collection only'],
  },
  {
    job_id: 'spg-source-ingest',
    label: 'SPG trends/RSS/monetized ingest',
    owner: 'dataeng/devops',
    command_argv: ['npm', 'run', 'spg:ingest:daily'],
    schedule: 'manual / daily bundle',
    description: 'Refreshes Google Trends, RSS candidates, Amazon manual lanes, Skimlinks/Stay22 candidate records, and durable SPG offer records.',
    expected_artifact: 'data/spg-durable-store.json',
    env_keys: ['SERP_API_KEY', 'SKIMLINKS_API_KEY or STAY22_API_KEY', 'CRM_AMAZON_ASSOCIATES_TAG'],
    side_effects: ['internal collection only'],
  },
  {
    job_id: 'spg-build-offer-qa',
    label: 'SPG build + offer QA',
    owner: 'webdev/leadfs',
    command_argv: ['npm', 'run', 'spg:build-offer-qa'],
    schedule: 'manual / daily bundle',
    description: 'Regenerates public offer/SEO pages and enforces card → /offers → disclosure → /go flow.',
    expected_artifact: 'public/sitemap.xml',
    env_keys: ['CRM_AMAZON_ASSOCIATES_TAG'],
    side_effects: ['local static build only'],
  },
  {
    job_id: 'full-test-suite',
    label: 'Full CRM/SPG test suite',
    owner: 'leadfs',
    command_argv: ['npm', 'test'],
    schedule: 'manual / release gate',
    description: 'Runs the full Node test suite for auth, CRM modules, Opportunity Desk, SPG offers, compliance gates, and daily artifacts.',
    expected_artifact: 'test output',
    env_keys: [],
    side_effects: ['local verification only'],
  },
]);

export class JobsStore {
  constructor({ path = DEFAULT_STORE_PATH, workdir = DEFAULT_WORKDIR, auditLog = null, definitions = DEFAULT_JOB_DEFINITIONS } = {}) {
    this.path = typeof path === 'string' ? path : path.pathname;
    this.workdir = workdir;
    this.auditLog = auditLog;
    this.definitions = definitions;
    this.running = new Map();
    this.state = this.load();
  }

  load() {
    try {
      return JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      return { schema_version: 'crm_jobs.v1', runs: [] };
    }
  }

  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  listJobs() {
    return this.definitions.map((definition) => {
      const runs = this.state.runs.filter((run) => run.job_id === definition.job_id);
      const latest = runs.at(-1) || null;
      return {
        ...safeDefinition(definition),
        env_status: envStatus(definition.env_keys),
        latest_run: latest ? summarizeRun(latest) : null,
        running: this.running.has(definition.job_id),
      };
    });
  }

  getRun(runId) {
    const run = this.state.runs.find((item) => item.run_id === runId);
    return run ? sanitizeRun(run) : null;
  }

  runJob(jobId, { actorId = 'admin' } = {}) {
    const definition = this.definitions.find((item) => item.job_id === jobId);
    if (!definition) {
      const error = new Error('unknown job_id');
      error.statusCode = 404;
      throw error;
    }
    if (this.running.has(jobId)) {
      const error = new Error('job already running');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const run = {
      run_id: `job_${jobId}_${Date.now()}`,
      job_id: jobId,
      label: definition.label,
      status: 'running',
      started_at: now,
      finished_at: null,
      actorId,
      command_ref: `allowlist:${jobId}`,
      expected_artifact: definition.expected_artifact,
      side_effects: definition.side_effects || [],
      log_excerpt: '',
      exit_code: null,
    };
    this.state.runs.push(run);
    this.state.runs = this.state.runs.slice(-80);
    this.save();
    this.auditLog?.record({ actorId, action: 'job.run.started', resourceType: 'crm_job', resourceId: jobId, metadata: { run_id: run.run_id, command_ref: run.command_ref } });

    const [command, ...args] = commandArgv(definition);
    const child = spawn(command, args, {
      cwd: resolve(this.workdir),
      env: { ...process.env, PATH: withLocalNodePath(process.env.PATH) },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.running.set(jobId, { child, run_id: run.run_id });

    let log = '';
    const append = (chunk) => {
      log = redact(`${log}${chunk.toString()}`).slice(-MAX_LOG_CHARS);
      run.log_excerpt = log;
      this.save();
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('close', (code) => {
      run.status = code === 0 ? 'success' : 'failed';
      run.exit_code = code;
      run.finished_at = new Date().toISOString();
      run.log_excerpt = redact(log).slice(-MAX_LOG_CHARS);
      this.running.delete(jobId);
      this.save();
      this.auditLog?.record({ actorId: 'system', action: 'job.run.finished', resourceType: 'crm_job', resourceId: jobId, metadata: { run_id: run.run_id, status: run.status, exit_code: code } });
    });
    child.on('error', (error) => {
      run.status = 'failed';
      run.exit_code = -1;
      run.finished_at = new Date().toISOString();
      run.log_excerpt = redact(`${log}\n${error.message}`).slice(-MAX_LOG_CHARS);
      this.running.delete(jobId);
      this.save();
    });

    return summarizeRun(run);
  }
}

function safeDefinition(definition) {
  const { command, command_argv: _commandArgv, ...rest } = definition;
  return { ...rest, command_ref: `allowlist:${definition.job_id}` };
}

function commandArgv(definition) {
  if (Array.isArray(definition.command_argv) && definition.command_argv.length) {
    return definition.command_argv.map((part) => String(part));
  }
  if (typeof definition.command === 'string' && definition.command.trim()) {
    const error = new Error(`job ${definition.job_id} must use command_argv allowlist; shell command strings are disabled`);
    error.statusCode = 500;
    throw error;
  }
  throw new Error(`job ${definition.job_id} has no allowlisted command argv`);
}

function withLocalNodePath(currentPath = '') {
  return ['/home/mehya/.local/bin', '/home/mehya/.local/node/bin', currentPath].filter(Boolean).join(':');
}

function summarizeRun(run) {
  return {
    run_id: run.run_id,
    job_id: run.job_id,
    label: run.label,
    status: run.status,
    started_at: run.started_at,
    finished_at: run.finished_at,
    exit_code: run.exit_code,
    command_ref: run.command_ref,
    expected_artifact: run.expected_artifact,
    side_effects: run.side_effects,
  };
}

function sanitizeRun(run) {
  return { ...run, log_excerpt: redact(run.log_excerpt || '') };
}

function redact(value) {
  return String(value || '').replace(SECRET_PATTERN, '$1=<redacted>');
}

function envStatus(envKeys = []) {
  return envKeys.map((label) => {
    const keys = String(label).split(/\s+or\s+/i).map((item) => item.trim()).filter(Boolean);
    const available = keys.some((key) => Boolean(process.env[key]));
    return { label, available, value: available ? '<set>' : '<missing>' };
  });
}
