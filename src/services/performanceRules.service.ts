import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import type { PerformanceTier } from '@prisma/client';

export interface TierThresholds {
  PROBATIONARY: number;
  STANDARD: number;
  PREFERRED: number;
}

export interface ScoreWeights {
  onTimeDelivery: number;
  quantityAccuracy: number;
  quality: number;
  availabilitySubmission: number;
}

export interface Penalties {
  lateSubmission: number;
  missedDelivery: number;
  qualityFail: number;
}

export interface WarningTriggers {
  deliveriesBeforeProbation?: number; // e.g. 1 = "miss one more delivery → probation"
  [key: string]: number | undefined;
}

export interface PerformanceRulesData {
  tierThresholds: TierThresholds;
  scoreWeights: ScoreWeights;
  penalties: Penalties;
  warningTriggers: WarningTriggers;
}

const DEFAULT_RULES: PerformanceRulesData = {
  tierThresholds: {
    PROBATIONARY: 0,
    STANDARD: 70,
    PREFERRED: 85,
  },
  scoreWeights: {
    onTimeDelivery: 0.3,
    quantityAccuracy: 0.3,
    quality: 0.25,
    availabilitySubmission: 0.15,
  },
  penalties: {
    lateSubmission: -5,
    missedDelivery: -15,
    qualityFail: -20,
  },
  warningTriggers: {
    deliveriesBeforeProbation: 1,
  },
};

/**
 * Get the active performance rules (most recent by effectiveFrom).
 * If none exist, returns default rules (and optionally seeds the DB).
 */
export async function getActivePerformanceRules(): Promise<PerformanceRulesData> {
  const rule = await prisma.performanceRule.findFirst({
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!rule) {
    return DEFAULT_RULES;
  }

  return {
    tierThresholds: rule.tierThresholds as unknown as TierThresholds,
    scoreWeights: rule.scoreWeights as unknown as ScoreWeights,
    penalties: rule.penalties as unknown as Penalties,
    warningTriggers: rule.warningTriggers as unknown as WarningTriggers,
  };
}

/**
 * Get the active performance rules record (for admin display with id, dates).
 */
export async function getPerformanceRulesRecord() {
  const rule = await prisma.performanceRule.findFirst({
    orderBy: { effectiveFrom: 'desc' },
  });
  return rule;
}

/**
 * Update performance rules (admin only). Creates a new row so we keep history.
 */
export async function updatePerformanceRules(
  adminId: string,
  data: PerformanceRulesData
) {
  const created = await prisma.performanceRule.create({
    data: {
      tierThresholds: data.tierThresholds as object,
      scoreWeights: data.scoreWeights as object,
      penalties: data.penalties as object,
      warningTriggers: data.warningTriggers as object,
      updatedBy: adminId,
    },
  });
  return created;
}

/**
 * Ensure default performance rules exist (call from seed or first run).
 */
export async function seedDefaultPerformanceRulesIfEmpty() {
  const existing = await prisma.performanceRule.count();
  if (existing > 0) return;

  await prisma.performanceRule.create({
    data: {
      tierThresholds: DEFAULT_RULES.tierThresholds as object,
      scoreWeights: DEFAULT_RULES.scoreWeights as object,
      penalties: DEFAULT_RULES.penalties as object,
      warningTriggers: DEFAULT_RULES.warningTriggers as object,
    },
  });
}
