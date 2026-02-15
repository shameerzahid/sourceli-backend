import { cloudinary } from '../config/cloudinary.js';
import { createError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  url: string;
  width?: number;
  height?: number;
  format: string;
  bytes: number;
}

/**
 * Upload image to Cloudinary
 * @param fileBuffer - File buffer from multer
 * @param folder - Cloudinary folder path (e.g., 'farm-photos')
 * @param fileName - Optional custom file name
 * @returns Upload result with URLs and metadata
 */
export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  fileName?: string
): Promise<UploadResult> {
  // Check if Cloudinary is configured
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw createError(
      'Cloudinary is not configured. Please set Cloudinary credentials in environment variables.',
      500,
      'CLOUDINARY_NOT_CONFIGURED'
    );
  }

  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: `sourceli/${folder}`,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        {
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    };

    if (fileName) {
      uploadOptions.public_id = fileName;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(
            createError(
              `Failed to upload image: ${error.message}`,
              500,
              'UPLOAD_FAILED'
            )
          );
          return;
        }

        if (!result) {
          reject(createError('Upload failed: No result returned', 500, 'UPLOAD_FAILED'));
          return;
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          url: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete image from Cloudinary
 * @param publicId - Cloudinary public ID
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw createError('Cloudinary is not configured', 500, 'CLOUDINARY_NOT_CONFIGURED');
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(
          createError(
            `Failed to delete image: ${error.message}`,
            500,
            'DELETE_FAILED'
          )
        );
        return;
      }

      if (result?.result !== 'ok' && result?.result !== 'not found') {
        reject(createError('Failed to delete image', 500, 'DELETE_FAILED'));
        return;
      }

      resolve();
    });
  });
}

/**
 * Validate image file
 * @param file - File object from multer
 * @returns True if valid, throws error if invalid
 */
export function validateImageFile(file: Express.Multer.File): void {
  // Check file type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype)) {
    throw createError(
      'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      400,
      'INVALID_FILE_TYPE'
    );
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    throw createError(
      'File size too large. Maximum size is 5MB.',
      400,
      'FILE_TOO_LARGE'
    );
  }

  // Check if file has buffer
  if (!file.buffer || file.buffer.length === 0) {
    throw createError('File buffer is empty', 400, 'EMPTY_FILE');
  }
}








