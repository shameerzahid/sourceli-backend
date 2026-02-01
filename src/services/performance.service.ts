import { prisma } from '../config/database.js';
import { PerformanceTier, AssignmentStatus, QualityResult } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

// Default performance rules (can be made configurable later)
const DEFAULT_TIER_THRESHOLDS = {
  PROBATIONARY: 0,
  STANDARD: 50,
  PREFERRED: 85,
};

const DEFAULT_SCORE_WEIGHTS = {
  onTimeDelivery: 0.3,      // 30%
  quantityAccuracy: 0.3,     // 30%
  quality: 0.25,              // 25%
  availabilitySubmission: 0.15, // 15%
};

const DEFAULT_BASE_SCORE = 50; // Starting score for Probationary farmers

interface PerformanceBreakdown {
  onTimeDeliveryScore: number;
  quantityAccuracyScore: number;
  qualityScore: number;
  availabilitySubmissionScore: number;
}

interface PerformanceData {
  score: number;
  tier: PerformanceTier;
  breakdown: PerformanceBreakdown;
}

/**
 * Calculate performance score for a farmer
 * Based on: on-time delivery, quantity accuracy, quality, availability submission
 */
export async function calculatePerformanceScore(farmerId: string): Promise<PerformanceData> {
  // Get all confirmed deliveries (DELIVERED or FAILED status)
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

  // Get availability submission history (last 8 weeks for calculation)
  const availabilityHistory = await prisma.weeklyAvailability.findMany({
    where: {
      farmerId,
    },
    orderBy: {
      weekStartDate: 'desc',
    },
    take: 8, // Last 8 weeks
  });

  // Calculate component scores
  const onTimeDeliveryScore = calculateOnTimeDeliveryScore(confirmedDeliveries);
  const quantityAccuracyScore = calculateQuantityAccuracyScore(confirmedDeliveries);
  const qualityScore = calculateQualityScore(confirmedDeliveries);
  const availabilitySubmissionScore = calculateAvailabilitySubmissionScore(availabilityHistory);

  // Calculate weighted total score
  const breakdown: PerformanceBreakdown = {
    onTimeDeliveryScore,
    quantityAccuracyScore,
    qualityScore,
    availabilitySubmissionScore,
  };

  const totalScore = Math.round(
    DEFAULT_BASE_SCORE +
    (onTimeDeliveryScore * DEFAULT_SCORE_WEIGHTS.onTimeDelivery) +
    (quantityAccuracyScore * DEFAULT_SCORE_WEIGHTS.quantityAccuracy) +
    (qualityScore * DEFAULT_SCORE_WEIGHTS.quality) +
    (availabilitySubmissionScore * DEFAULT_SCORE_WEIGHTS.availabilitySubmission)
  );

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, totalScore));

  // Determine tier based on score
  const tier = determineTier(finalScore);

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
 * Determine tier based on score
 */
function determineTier(score: number): PerformanceTier {
  if (score >= DEFAULT_TIER_THRESHOLDS.PREFERRED) {
    return PerformanceTier.PREFERRED;
  } else if (score >= DEFAULT_TIER_THRESHOLDS.STANDARD) {
    return PerformanceTier.STANDARD;
  } else {
    return PerformanceTier.PROBATIONARY;
  }
}

/**
 * Update farmer performance score and tier
 * Creates or updates performance record and logs history
 */
export async function updatePerformanceScore(
  farmerId: string,
  reason: string,
  deliveryAssignmentId?: string,
  createdBy?: string
): Promise<void> {
  // Calculate new performance
  const performanceData = await calculatePerformanceScore(farmerId);

  // Get current performance (if exists)
  const currentPerformance = await prisma.farmerPerformance.findUnique({
    where: { farmerId },
  });

  const previousScore = currentPerformance?.score ?? DEFAULT_BASE_SCORE;
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
  const trend: Array<{ date: Date; score: number; tier: PerformanceTier }> = [];

  // Add history points
  for (const entry of history) {
    trend.push({
      date: entry.createdAt,
      score: entry.newScore,
      tier: entry.newTier,
    });
  }

  // Add current point if exists
  if (current) {
    trend.push({
      date: new Date(),
      score: current.score,
      tier: current.tier,
    });
  }

  // Sort by date
  trend.sort((a, b) => a.date.getTime() - b.date.getTime());

  return trend;
}

/**
 * Get tier thresholds (for display purposes)
 */
export function getTierThresholds() {
  return DEFAULT_TIER_THRESHOLDS;
}

/**
 * Get score weights (for display purposes)
 */
export function getScoreWeights() {
  return DEFAULT_SCORE_WEIGHTS;
}

