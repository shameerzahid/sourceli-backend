import { prisma } from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { UserStatus } from '@prisma/client';

export interface CreateDeliveryAddressData {
  address: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface UpdateDeliveryAddressData {
  address?: string;
  landmark?: string;
  isDefault?: boolean;
}

/**
 * Get all delivery addresses for a buyer
 */
export async function getDeliveryAddresses(buyerId: string) {
  const addresses = await prisma.deliveryAddress.findMany({
    where: {
      buyerId,
    },
    orderBy: [
      { isDefault: 'desc' }, // Default first
      { createdAt: 'desc' },
    ],
  });

  return addresses;
}

/**
 * Create a new delivery address
 */
export async function createDeliveryAddress(
  buyerId: string,
  data: CreateDeliveryAddressData
) {
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await prisma.deliveryAddress.updateMany({
      where: {
        buyerId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  // If no default exists and this isn't explicitly set, make it default
  const existingDefault = await prisma.deliveryAddress.findFirst({
    where: {
      buyerId,
      isDefault: true,
    },
  });

  const isDefault = data.isDefault ?? !existingDefault;

  const address = await prisma.deliveryAddress.create({
    data: {
      buyerId,
      address: data.address.trim(),
      landmark: data.landmark?.trim(),
      isDefault,
    },
  });

  return address;
}

/**
 * Update a delivery address
 */
export async function updateDeliveryAddress(
  addressId: string,
  buyerId: string,
  data: UpdateDeliveryAddressData
) {
  // Verify address belongs to buyer
  const existing = await prisma.deliveryAddress.findFirst({
    where: {
      id: addressId,
      buyerId,
    },
  });

  if (!existing) {
    throw createError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  // If setting as default, unset other defaults
  if (data.isDefault === true) {
    await prisma.deliveryAddress.updateMany({
      where: {
        buyerId,
        id: { not: addressId },
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  const updated = await prisma.deliveryAddress.update({
    where: { id: addressId },
    data: {
      address: data.address?.trim(),
      landmark: data.landmark?.trim(),
      isDefault: data.isDefault,
    },
  });

  return updated;
}

/**
 * Delete a delivery address
 */
export async function deleteDeliveryAddress(addressId: string, buyerId: string) {
  // Verify address belongs to buyer
  const existing = await prisma.deliveryAddress.findFirst({
    where: {
      id: addressId,
      buyerId,
    },
  });

  if (!existing) {
    throw createError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  // Check if address is used in any orders
  const ordersUsingAddress = await prisma.order.findFirst({
    where: {
      deliveryAddressId: addressId,
    },
  });

  if (ordersUsingAddress) {
    throw createError(
      'Cannot delete address that is used in existing orders',
      400,
      'ADDRESS_IN_USE'
    );
  }

  await prisma.deliveryAddress.delete({
    where: { id: addressId },
  });

  return { success: true };
}







