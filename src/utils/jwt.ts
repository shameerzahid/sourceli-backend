import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  role: 'ADMIN' | 'FARMER' | 'BUYER';
  status: string;
  email: string;
}

/**
 * Generate a short-lived access token (1 hour)
 * @param payload - Token payload containing user information
 * @returns JWT access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  try {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET is not configured or too short (minimum 32 characters)');
    }
    
    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN, // 1 hour
    } as jwt.SignOptions);
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('JWT Access Token Generation Error:', errorMessage);
    throw new Error(`Failed to generate access token: ${errorMessage}`);
  }
}

/**
 * Generate a long-lived refresh token (7 days)
 * @param payload - Token payload containing user information
 * @returns JWT refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  try {
    if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT_REFRESH_SECRET is not configured or too short (minimum 32 characters)');
    }
    
    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN, // 7 days
    } as jwt.SignOptions);
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('JWT Refresh Token Generation Error:', errorMessage);
    throw new Error(`Failed to generate refresh token: ${errorMessage}`);
  }
}

/**
 * Verify and decode an access token
 * @param token - JWT access token
 * @returns Decoded token payload or null if invalid
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 * @param token - JWT refresh token
 * @returns Decoded token payload or null if invalid
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decode a token without verification (for debugging/inspection)
 * @param token - JWT token
 * @returns Decoded token payload or null if invalid format
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    return decoded;
  } catch (error) {
    return null;
  }
}

