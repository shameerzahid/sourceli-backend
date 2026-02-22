import { prisma } from '../config/database.js';
import { PerformanceTier, AssignmentStatus, QualityResult } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { getActivePerformanceRules } from './performanceRules.service.js';
import type { TierThresholds, ScoreWeights, Penalties } from './performanceRules.service.js';

const DEFAULT_BASE_SCORE = 50; // Starting score for Probationary farmers

interface PerformanceBreakdown {
  onTimeDeliveryScore: number;
  quantityAccuracyScore: number;
  qualityScore: number;
  availabilitySubmissionScore: number;
}

export interface PerformanceData {
  score: number;
  tier: PerformanceTier;
  breakdown: PerformanceBreakdown;
}

/**
 * Calculate performance score for a farmer using active rules from DB.
 * Applies penalties for late submission, missed delivery, quality fail.
 */
export async function calculatePerformanceScore(farmerId: string): Promise<PerformanceData> {
  const rules = await getActivePerformanceRules();

  const confirmedDeliveries = await prisma.deliveryAssignment.findMany({
    where: {
      farmerId,
      status: {
        in: [AssignmentStatus.DELIVERED, AssignmentStatus.FAILED],
      },
      confirmedAt: {
        not: null,
      },
    },
    orderBy: {
      confirmedAt: 'desc',
    },
  });

  const availabilityHistory = await prisma.weeklyAvailability.findMany({
    where: { farmerId },
    orderBy: { weekStartDate: 'desc' },
    take: 8,
  });

  const onTimeDeliveryScore = calculateOnTimeDeliveryScore(confirmedDeliveries);
  const quantityAccuracyScore = calculateQuantityAccuracyScore(confirmedDeliveries);
  const qualityScore = calculateQualityScore(confirmedDeliveries);
  const availabilitySubmissionScore = calculateAvailabilitySubmissionScore(availabilityHistory);

  const breakdown: PerformanceBreakdown = {
    onTimeDeliveryScore,
    quantityAccuracyScore,
    qualityScore,
    availabilitySubmissionScore,
  };

  const weights = rules.scoreWeights;
  let totalScore =
    DEFAULT_BASE_SCORE +
    (onTimeDeliveryScore * weights.onTimeDelivery) +
    (quantityAccuracyScore * weights.quantityAccuracy) +
    (qualityScore * weights.quality) +
    (availabilitySubmissionScore * weights.availabilitySubmission);

  // Apply penalties from rules
  const lateCount = availabilityHistory.filter((av) => av.isLate).length;
  const missedCount = confirmedDeliveries.filter((d) => d.status === AssignmentStatus.FAILED).length;
  const qualityFailCount = confirmedDeliveries.filter(
    (d) => d.status === AssignmentStatus.DELIVERED && d.qualityResult === QualityResult.FAIL
  ).length;

  const penalties = rules.penalties;
  totalScore += lateCount * (penalties.lateSubmission ?? 0);
  totalScore += missedCount * (penalties.missedDelivery ?? 0);
  totalScore += qualityFailCount * (penalties.qualityFail ?? 0);

  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const tier = determineTier(finalScore, rules.tierThresholds);

  return {
    score: finalScore,
    tier,
    breakdown,
  };
}

/**
 * Calculate on-time delivery score (0-100)
 * Based on percentage of deliveries that were on time
 */
function calculateOnTimeDeliveryScore(deliveries: any[]): number {
  if (deliveries.length === 0) {
    return 0; // No deliveries = 0 score
  }

  const onTimeDeliveries = deliveries.filter((delivery) => {
    if (delivery.status !== AssignmentStatus.DELIVERED) {
      return false; // Failed deliveries are not on-time
    }

    // Check if delivery was on time (delivered on or before scheduled date)
    const deliveryDate = new Date(delivery.deliveryDate);
    const confirmedDate = delivery.confirmedAt ? new Date(delivery.confirmedAt) : null;
    
    if (!confirmedDate) {
      return false;
    }

    // Consider on-time if delivered on the scheduled date or up to 1 day late (grace period)
    const daysDifference = Math.floor(
      (confirmedDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysDifference <= 1; // On-time if within 1 day
  });

  const onTimePercentage = (onTimeDeliveries.length / deliveries.length) * 100;
  return Math.round(onTimePercentage);
}

/**
 * Calculate quantity accuracy score (0-100)
 * Based on how close delivered quantity is to assigned quantity
 */
function calculateQuantityAccuracyScore(deliveries: any[]): number {
  if (deliveries.length === 0) {
    return 0;
  }

  const deliveredAssignments = deliveries.filter(
    (d) => d.status === AssignmentStatus.DELIVERED && d.quantityDelivered !== null
  );

  if (deliveredAssignments.length === 0) {
    return 0;
  }

  let totalAccuracy = 0;
  for (const delivery of deliveredAssignments) {
    const assigned = delivery.assignedQuantity;
    const delivered = delivery.quantityDelivered || 0;
    
    // Calculate accuracy percentage (100% if exact match, decreases with difference)
    const accuracy = Math.min(100, (delivered / assigned) * 100);
    totalAccuracy += accuracy;
  }

  return Math.round(totalAccuracy / deliveredAssignments.length);
}

/**
 * Calculate quality score (0-100)
 * Based on quality results: PASS = 100, PARTIAL = 50, FAIL = 0
 */
function calculateQualityScore(deliveries: any[]): number {
  if (deliveries.length === 0) {
    return 0;
  }

  const deliveredAssignments = deliveries.filter(
    (d) => d.status === AssignmentStatus.DELIVERED && d.qualityResult !== null
  );

  if (deliveredAssignments.length === 0) {
    return 0;
  }

  let totalQualityScore = 0;
  for (const delivery of deliveredAssignments) {
    switch (delivery.qualityResult) {
      case QualityResult.PASS:
        totalQualityScore += 100;
        break;
      case QualityResult.PARTIAL:
        totalQualityScore += 50;
        break;
      case QualityResult.FAIL:
        totalQualityScore += 0;
        break;
      default:
        totalQualityScore += 0;
    }
  }

  return Math.round(totalQualityScore / deliveredAssignments.length);
}

/**
 * Calculate availability submission score (0-100)
 * Based on on-time vs late submissions
 */
function calculateAvailabilitySubmissionScore(availabilityHistory: any[]): number {
  if (availabilityHistory.length === 0) {
    return 0; // No submissions = 0 score
  }

  const onTimeSubmissions = availabilityHistory.filter((av) => !av.isLate);
  const onTimePercentage = (onTimeSubmissions.length / availabilityHistory.length) * 100;
  
  return Math.round(onTimePercentage);
}

/**
 * Determine tier based on score and configured thresholds
 */
function determineTier(score: number, thresholds: TierThresholds): PerformanceTier {
  if (score >= (thresholds.PREFERRED ?? 85)) {
    return PerformanceTier.PREFERRED;
  }
  if (score >= (thresholds.STANDARD ?? 70)) {
    return PerformanceTier.STANDARD;
  }
  return PerformanceTier.PROBATIONARY;
}

/**
 * Update farmer performance score and tier
 * Creates or updates performance record and logs history.
 * Returns previous and new tier for notification triggers.
 */
export async function updatePerformanceScore(
  farmerId: string,
  reason: string,
  deliveryAssignmentId?: string,
  createdBy?: string
): Promise<{ previousTier: PerformanceTier; newTier: PerformanceTier }> {
  // Calculate new performance
  const performanceData = await calculatePerformanceScore(farmerId);

  // Get current performance (if exists)
  const currentPerformance = await prisma.farmerPerformance.findUnique({
    where: { farmerId },
  });

  const previousScore = currentPerformance?.score ?? 50;
  const previousTier = currentPerformance?.tier ?? PerformanceTier.PROBATIONARY;

  // Update or create performance record
  await prisma.farmerPerformance.upsert({
    where: { farmerId },
    create: {
      farmerId,
      score: performanceData.score,
      tier: performanceData.tier,
    },
    update: {
      score: performanceData.score,
      tier: performanceData.tier,
    },
  });

  // Update breakdown
  await prisma.farmerPerformanceBreakdown.upsert({
    where: { farmerId },
    create: {
      farmerId,
      onTimeDeliveryScore: performanceData.breakdown.onTimeDeliveryScore,
      quantityAccuracyScore: performanceData.breakdown.quantityAccuracyScore,
      qualityScore: performanceData.breakdown.qualityScore,
      availabilitySubmissionScore: performanceData.breakdown.availabilitySubmissionScore,
    },
    update: {
      onTimeDeliveryScore: performanceData.breakdown.onTimeDeliveryScore,
      quantityAccuracyScore: performanceData.breakdown.quantityAccuracyScore,
      qualityScore: performanceData.breakdown.qualityScore,
      availabilitySubmissionScore: performanceData.breakdown.availabilitySubmissionScore,
    },
  });

  // Log history if score or tier changed
  if (
    previousScore !== performanceData.score ||
    previousTier !== performanceData.tier
  ) {
    await prisma.farmerPerformanceHistory.create({
      data: {
        farmerId,
        previousScore,
        newScore: performanceData.score,
        previousTier,
        newTier: performanceData.tier,
        reason,
        deliveryAssignmentId: deliveryAssignmentId ?? null,
        createdBy: createdBy ?? null,
      },
    });
  }

  return {
    previousTier,
    newTier: performanceData.tier,
  };
}

/**
 * Get current performance data for a farmer
 */
export async function getPerformanceData(farmerId: string) {
  const performance = await prisma.farmerPerformance.findUnique({
    where: { farmerId },
  });

  const breakdown = await prisma.farmerPerformanceBreakdown.findUnique({
    where: { farmerId },
  });

  if (!performance) {
    // Initialize performance if doesn't exist
    await updatePerformanceScore(farmerId, 'Initial performance calculation');
    
    // Fetch again
    const newPerformance = await prisma.farmerPerformance.findUnique({
      where: { farmerId },
    });
    const newBreakdown = await prisma.farmerPerformanceBreakdown.findUnique({
      where: { farmerId },
    });

    return {
      performance: newPerformance,
      breakdown: newBreakdown,
    };
  }

  return {
    performance,
    breakdown,
  };
}

/**
 * Get performance history for a farmer
 * @param farmerId Farmer ID
 * @param days Number of days to look back (default: 30)
 */
export async function getPerformanceHistory(farmerId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const history = await prisma.farmerPerformanceHistory.findMany({
    where: {
      farmerId,
      createdAt: {
        gte: startDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return history;
}

/**
 * Get recent score changes for a farmer
 * @param farmerId Farmer ID
 * @param limit Number of recent changes to return (default: 10)
 */
export async function getRecentChanges(farmerId: string, limit: number = 10) {
  const changes = await prisma.farmerPerformanceHistory.findMany({
    where: { farmerId },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return changes;
}

/**
 * Get performance trend data (daily scores for chart)
 * @param farmerId Farmer ID
 * @param days Number of days (default: 30)
 */
export async function getPerformanceTrend(farmerId: string, days: number = 30) {
  // Get all history entries within the period
  const history = await getPerformanceHistory(farmerId, days);

  // Get current performance
  const current = await prisma.farmerPerformance.findUnique({
    where: { farmerId },
  });

  // Build trend data
  const trend: Array<{ date: string; score: number; tier: PerformanceTier }> = [];

  // Add history points
  for (const entry of history) {
    trend.push({
      date: entry.createdAt.toISOString(),
      score: entry.newScore,
      tier: entry.newTier,
    });
  }

  // Add current point if exists
  if (current) {
    trend.push({
      date: new Date().toISOString(),
      score: current.score,
      tier: current.tier,
    });
  }

  // Sort by date
  trend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return trend;
}

/**
 * Get tier thresholds (from active rules)
 */
export async function getTierThresholds() {
  const rules = await getActivePerformanceRules();
  return rules.tierThresholds;
}

/**
 * Get score weights (from active rules)
 */
export async function getScoreWeights() {
  const rules = await getActivePerformanceRules();
  return rules.scoreWeights;
}

/**
 * Get warnings for farmer (e.g. "one more missed delivery → probation") from warning triggers.
 */
export async function getPerformanceWarnings(farmerId: string): Promise<string[]> {
  const rules = await getActivePerformanceRules();
  const triggers = rules.warningTriggers;
  const warnings: string[] = [];

  const performance = await prisma.farmerPerformance.findUnique({
    where: { farmerId },
  });
  if (!performance) return warnings;

  const beforeProbation = triggers.deliveriesBeforeProbation;
  if (beforeProbation !== undefined && performance.tier !== PerformanceTier.PROBATIONARY) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFailed = await prisma.deliveryAssignment.count({
      where: {
        farmerId,
        status: AssignmentStatus.FAILED,
        confirmedAt: {
          not: null,
          gte: thirtyDaysAgo,
        },
      },
    });
    if (recentFailed >= (beforeProbation - 1) && recentFailed < beforeProbation) {
      warnings.push(
        `Miss one more delivery and your tier may drop to Probationary.`
      );
    }
  }

  return warnings;
}

/**
 * Admin override: set farmer score and/or tier with reason (audit logged).
 */
export async function overridePerformanceScore(
  farmerId: string,
  adminId: string,
  data: { score?: number; tier?: PerformanceTier; reason: string }
): Promise<void> {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: { performance: true },
  });
  if (!farmer) {
    throw createError('Farmer not found', 404, 'FARMER_NOT_FOUND');
  }

  const current = farmer.performance;
  const previousScore = current?.score ?? 50;
  const previousTier = current?.tier ?? PerformanceTier.PROBATIONARY;
  const newScore = data.score ?? previousScore;
  const newTier = data.tier ?? previousTier;

  const clampedScore = Math.max(0, Math.min(100, newScore));

  await prisma.farmerPerformance.upsert({
    where: { farmerId },
    create: {
      farmerId,
      score: clampedScore,
      tier: newTier,
    },
    update: {
      score: clampedScore,
      tier: newTier,
    },
  });

  await prisma.farmerPerformanceHistory.create({
    data: {
      farmerId,
      previousScore,
      newScore: clampedScore,
      previousTier,
      newTier,
      reason: `Admin override: ${data.reason}`,
      createdBy: adminId,
    },
  });
}

