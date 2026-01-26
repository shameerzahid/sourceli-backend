import { prisma } from '../config/database.js';

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
  // Check if category already exists
  const existing = await prisma.produceCategory.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error(`Produce category "${data.name}" already exists`);
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


