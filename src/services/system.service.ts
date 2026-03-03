import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Get allowed delivery coverage regions (US-BUYER-005).
 * From env DELIVERY_COVERAGE_REGIONS (comma-separated). Empty if not set.
 */
export function getDeliveryCoverageRegions(): string[] {
  const raw = env.DELIVERY_COVERAGE_REGIONS;
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((r) => r.trim()).filter(Boolean);
}

export interface CreateProduceCategoryData {
  name: string;
  unitType: string; // e.g., "kg", "units"
}

/**
 * Get all produce categories
 * This is a public endpoint - no authentication required
 */
export async function getProduceCategories() {
  const categories = await prisma.produceCategory.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  return categories;
}

/**
 * Create a new produce category
 * Admin only - for future use
 */
export async function createProduceCategory(data: CreateProduceCategoryData) {
  const existing = await prisma.produceCategory.findUnique({
    where: { name: data.name.trim() },
  });
  if (existing) {
    throw createError(`Produce category "${data.name.trim()}" already exists`, 409, 'DUPLICATE_CATEGORY');
  }

  const category = await prisma.produceCategory.create({
    data: {
      name: data.name.trim(),
      unitType: data.unitType.trim(),
    },
  });

  return category;
}

/**
 * Get a specific produce category by ID
 */
export async function getProduceCategoryById(id: string) {
  const category = await prisma.produceCategory.findUnique({
    where: { id },
  });

  if (!category) {
    throw new Error('Produce category not found');
  }

  return category;
}







