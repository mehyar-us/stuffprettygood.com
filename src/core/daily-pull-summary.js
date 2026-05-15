import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DEFAULT_DAILY_PULL_PATH = 'data/daily-pull/latest.json';

export function loadDailyPullSummary({ path = DEFAULT_DAILY_PULL_PATH } = {}) {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) {
    return {
      available: false,
      status: 'missing',
      generated_at: null,
      source_families: [],
      counts: {},
      opportunity_source_health: {},
      guardrails: [],
      deploy_status: 'unknown',
      log_file_name: null,
      next_actions: defaultNextActions(),
    };
  }

  const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
  return {
    available: true,
    status: sanitizeValue(raw.status || 'unknown'),
    generated_at: raw.generated_at || null,
    source_families: Array.isArray(raw.source_families) ? raw.source_families.map(sanitizeValue) : [],
    counts: sanitizeCounts(raw.counts || {}),
    opportunity_source_health: sanitizeCounts(raw.opportunity_source_health || {}),
    guardrails: Array.isArray(raw.guardrails) ? raw.guardrails.map(sanitizeValue) : [],
    deploy_status: sanitizeValue(raw.deploy_status || 'unknown'),
    log_file_name: raw.log_file ? basename(String(raw.log_file)) : null,
    next_actions: defaultNextActions(),
  };
}

function defaultNextActions() {
  return [
    {
      label: 'Route top opportunity for ProductOps review',
      target: 'internal_kanban',
      route_type: 'review',
      href: '#opportunity-desk',
      side_effect: 'kanban_only',
    },
    {
      label: 'Create SPG offer proof review card',
      target: 'internal_kanban',
      route_type: 'review',
      href: '#spg-offers',
      side_effect: 'kanban_only',
    },
    {
      label: 'Open source-health fix card',
      target: 'internal_kanban',
      route_type: 'data_quality',
      href: '#daily-money-dashboard',
      side_effect: 'kanban_only',
    },
  ];
}

function sanitizeCounts(input) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [sanitizeKey(key), Number(value || 0)]));
}

function sanitizeKey(value) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
}

function sanitizeValue(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, 240);
}
