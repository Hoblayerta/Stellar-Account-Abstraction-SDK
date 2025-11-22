import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters');
}

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Derive encryption key from master key and salt
 */
function deriveKey(salt: string): Buffer {
  return crypto.pbkdf2Sync(
    ENCRYPTION_KEY!,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(text: string, salt: string): string {
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Combine IV + encrypted + tag
  return iv.toString('hex') + encrypted + tag.toString('hex');
}

/**
 * Decrypt data
 */
export function decrypt(encryptedData: string, salt: string): string {
  const key = deriveKey(salt);

  const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
  const tagHex = encryptedData.slice(-TAG_LENGTH * 2);
  const encryptedHex = encryptedData.slice(IV_LENGTH * 2, -TAG_LENGTH * 2);

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a new Stellar signing keypair
 */
export function generateSigningKeypair(): Keypair {
  return Keypair.random();
}

/**
 * Generate verification code (6 digits)
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash data for comparison (email, etc)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
