export const CAMPAIGN_STATUSES = Object.freeze([
  'draft',
  'evidence-needed',
  'compliance-review',
  'Boss-approval-needed',
  'ready-for-dry-run',
  'blocked',
]);

export const STATUSES_REQUIRING_APPROVAL = Object.freeze([
  'Boss-approval-needed',
  'ready-for-dry-run',
]);

const LEGACY_CAMPAIGN_STATUS_MAP = Object.freeze({
  review: 'compliance-review',
  remediation: 'evidence-needed',
  future_pilot_approved: 'ready-for-dry-run',
  paused: 'blocked',
  cancelled: 'blocked',
});

export const REQUIRED_SUPPRESSION_CATEGORIES = Object.freeze([
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

const APPROVED = 'approved';

export function validateSuppressionApproval(approval = {}) {
  const reasons = [];

  if (approval.state !== APPROVED) {
    reasons.push('suppression approval state must be approved');
  }
  if (!approval.approvedBy) {
    reasons.push('suppression approval requires approvedBy');
  }
  if (!approval.approvedAt) {
    reasons.push('suppression approval requires approvedAt');
  }
  if (!Number.isInteger(approval.blockedRecipientCount) || approval.blockedRecipientCount < 0) {
    reasons.push('suppression approval requires non-negative integer blockedRecipientCount');
  }

  const checked = new Set(approval.checkedCategories || []);
  for (const category of REQUIRED_SUPPRESSION_CATEGORIES) {
    if (!checked.has(category)) {
      reasons.push(`suppression category not checked: ${category}`);
    }
  }

  if ((approval.unresolvedFindings || []).length > 0) {
    reasons.push('suppression approval has unresolved findings');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function validateComplianceApproval(approval = {}, campaign = {}) {
  const reasons = [];

  if (approval.state !== APPROVED) {
    reasons.push('compliance approval state must be approved');
  }
  if (!approval.approvedBy) {
    reasons.push('compliance approval requires approvedBy');
  }
  if (!approval.approvedAt) {
    reasons.push('compliance approval requires approvedAt');
  }
  if (!approval.legalBasis) {
    reasons.push('compliance approval requires legalBasis');
  }
  if (!approval.senderIdentityApproved) {
    reasons.push('sender identity must be approved');
  }

  if (campaign.channel === 'email' && !approval.unsubscribeUrlVerified) {
    reasons.push('email campaign requires verified unsubscribe URL');
  }
  if (campaign.channel === 'sms' && !approval.smsStopHandlingVerified) {
    reasons.push('SMS campaign requires verified STOP handling');
  }
  if ((approval.unresolvedFindings || []).length > 0) {
    reasons.push('compliance approval has unresolved findings');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function evaluateCampaignTransition({ campaign = {}, targetStatus, actorId, now = new Date().toISOString() }) {
  targetStatus = LEGACY_CAMPAIGN_STATUS_MAP[targetStatus] || targetStatus;
  if (!CAMPAIGN_STATUSES.includes(targetStatus)) {
    return auditDecision({ campaign, targetStatus, actorId, now, allowed: false, reasons: [`unknown target status: ${targetStatus}`] });
  }

  if (targetStatus === 'draft' || targetStatus === 'blocked' || targetStatus === 'evidence-needed') {
    return auditDecision({ campaign, targetStatus, actorId, now, allowed: true, reasons: [] });
  }

  const suppression = validateSuppressionApproval(campaign.suppressionApproval);
  const compliance = validateComplianceApproval(campaign.complianceApproval, campaign);
  const reasons = [...suppression.reasons, ...compliance.reasons];

  if (targetStatus === 'ready-for-dry-run') {
    const pilotAuthorization = validatePilotAuthorization(campaign.pilotAuthorization);
    reasons.push(...pilotAuthorization.reasons);
  }

  return auditDecision({
    campaign,
    targetStatus,
    actorId,
    now,
    allowed: reasons.length === 0,
    reasons,
  });
}

export function validatePilotAuthorization(authorization = {}) {
  const reasons = [];

  if (authorization.state !== APPROVED) {
    reasons.push('future pilot approval requires separate pilot authorization');
  }
  if (!authorization.authorizedBy) {
    reasons.push('future pilot authorization requires authorizedBy');
  }
  if (!authorization.authorizedAt) {
    reasons.push('future pilot authorization requires authorizedAt');
  }
  if (authorization.externalExecutionAllowed === true || authorization.providerPushAllowed === true || authorization.recipientExportAllowed === true) {
    reasons.push('future pilot approval cannot authorize send, export, or provider push in Phase 1');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function auditDecision({ campaign, targetStatus, actorId, now, allowed, reasons }) {
  return {
    campaignId: campaign.id || null,
    targetStatus,
    decision: allowed ? 'allowed' : 'blocked',
    allowed,
    reasons,
    suppressionState: campaign.suppressionApproval?.state || null,
    complianceState: campaign.complianceApproval?.state || null,
    actorId: actorId || null,
    decidedAt: now,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const decision = evaluateCampaignTransition({
    campaign: { id: 'demo', channel: 'email' },
    targetStatus: 'review',
    actorId: 'system-demo',
  });
  console.log(JSON.stringify(decision, null, 2));
}
