export function buildDashboard({ authStore, auditLog, database = null, commandCenter = null, now = new Date().toISOString() }) {
  const auth = authStore.stats();
  const databaseStatus = database?.status || 'not_configured';
  const commandSummary = commandCenter?.buildSummary();

  return {
    generatedAt: now,
    service: {
      name: 'Mehyar Media CRM Command Center',
      status: 'healthy',
      phase: 'phase_1_control_room',
      massSendingEnabled: false,
    },
    database: {
      status: databaseStatus,
      host: database?.host || null,
      port: database?.port || null,
      database: database?.database || null,
      migrations: database?.migrations || 'pending',
      appliedMigrations: database?.appliedMigrations || 0,
      pendingMigrations: database?.pendingMigrations || [],
      configuredEnv: database?.configuredEnv || [],
    },
    auth: {
      status: auth.users > 0 ? 'ready' : 'needs_admin_seed',
      users: auth.users,
      roles: auth.roles,
      activeSessions: auth.activeSessions,
    },
    widgets: {
      leadCounts: { status: commandSummary?.legacySource.status === 'connected' ? 'legacy_source_connected' : 'stubbed', totalKnownLeads: null, source: 'legacy_ionos_pending_safe_connection' },
      brands: { status: commandSummary?.firstBrandReady ? 'first_brand_seeded' : 'needs_first_brand', total: commandSummary?.counts.brands || 0, nextRequired: 'connect stuffprettygood.com on Hostinger after DNS is ready' },
      domains: { status: commandSummary?.crmDomain ? 'crm_domain_planned' : 'needs_crm_domain', total: commandSummary?.counts.domains || 0, crmDomain: commandSummary?.crmDomain?.domain || null },
      campaigns: { status: 'draft_only', totalDrafts: commandSummary?.counts.campaigns || 0, massSendingEnabled: false },
      lists: { status: 'safe_query_lists_only', total: commandSummary?.counts.lists || 0 },
      integrations: { status: 'external_secret_required', total: commandSummary?.counts.integrations || 0 },
      segments: { status: 'safe_preview_available', materializationRequiresApproval: true, maxPreviewRows: 100 },
      suppressions: { status: 'compliance_gate_available', blockingCategories: 7 },
      pilotReadiness: commandSummary?.pilotReadiness || null,
      riskAlerts: [
        'No mass sending endpoint enabled in Phase 1',
        'Legacy IONOS source must remain read-only with limited previews',
        'Production secrets must be injected via environment, not committed',
      ],
    },
    audit: {
      status: 'ready',
      events: auditLog.count(),
      recent: auditLog.list({ limit: 10 }),
    },
  };
}
