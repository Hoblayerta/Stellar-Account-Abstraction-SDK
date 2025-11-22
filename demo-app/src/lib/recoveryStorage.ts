/**
 * Local Recovery Storage - SEP-30 Compliant
 * Simula recovery server para demo/development
 * En producción, esto sería un servidor real con database
 */

import { Keypair } from '@stellar/stellar-sdk';

export interface RecoveryMethod {
  type: 'email' | 'github' | 'google';
  identifier: string; // email, github_id, google_sub
  metadata?: {
    name?: string;
    email?: string;
    avatar_url?: string;
    login?: string;
  };
  verified: boolean;
  addedAt: number;
}

export interface AccountRecoveryData {
  stellarAddress: string;
  primaryIdentifier: string; // El ID principal (email, github_id, etc)
  recoveryMethods: RecoveryMethod[];
  encryptedSeed: string; // Seed encriptado con password derivado de recovery methods
  createdAt: number;
  lastUpdated: number;
}

const STORAGE_KEY = 'stellar_recovery_data';

/**
 * Simple encryption usando SubtleCrypto
 */
async function encryptSeed(seed: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('stellar-recovery-salt'), // En prod: random salt
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt seed
 */
async function decryptSeed(encryptedData: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Derive same key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('stellar-recovery-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

/**
 * Generate recovery password from identifiers
 */
function generateRecoveryPassword(identifiers: string[]): string {
  // Combina los identifiers de recovery methods
  // En producción, esto sería más sofisticado
  return identifiers.sort().join(':');
}

/**
 * Save recovery data
 */
export async function saveRecoveryData(
  stellarAddress: string,
  primaryIdentifier: string,
  recoveryMethods: RecoveryMethod[],
  keypairSecret: string
): Promise<void> {
  // Generate password from recovery methods
  const identifiers = recoveryMethods.map(m => m.identifier);
  const password = generateRecoveryPassword(identifiers);

  // Encrypt seed
  const encryptedSeed = await encryptSeed(keypairSecret, password);

  const data: AccountRecoveryData = {
    stellarAddress,
    primaryIdentifier,
    recoveryMethods,
    encryptedSeed,
    createdAt: Date.now(),
    lastUpdated: Date.now()
  };

  // Get existing data
  const existing = getAllRecoveryData();
  existing[stellarAddress] = data;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  console.log('✅ Recovery data saved for:', stellarAddress);
}

/**
 * Get recovery data by stellar address
 */
export function getRecoveryData(stellarAddress: string): AccountRecoveryData | null {
  const all = getAllRecoveryData();
  return all[stellarAddress] || null;
}

/**
 * Get all recovery data
 */
function getAllRecoveryData(): Record<string, AccountRecoveryData> {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

/**
 * Find account by recovery method
 */
export function findAccountByRecoveryMethod(
  type: string,
  identifier: string
): AccountRecoveryData | null {
  const all = getAllRecoveryData();

  for (const data of Object.values(all)) {
    const method = data.recoveryMethods.find(
      m => m.type === type && m.identifier === identifier
    );
    if (method) {
      return data;
    }
  }

  return null;
}

/**
 * Recover account using recovery methods
 */
export async function recoverAccount(
  verifiedMethods: Array<{ type: string; identifier: string }>
): Promise<{ keypair: Keypair; address: string } | null> {
  // Find account with ANY of the verified methods
  let accountData: AccountRecoveryData | null = null;

  for (const method of verifiedMethods) {
    accountData = findAccountByRecoveryMethod(method.type, method.identifier);
    if (accountData) break;
  }

  if (!accountData) {
    console.error('❌ No account found for recovery methods');
    return null;
  }

  // Check if we have enough verified methods
  const verifiedIdentifiers = verifiedMethods.map(m => m.identifier);
  const accountIdentifiers = accountData.recoveryMethods.map(m => m.identifier);

  // Need at least one matching method
  const hasMatch = verifiedIdentifiers.some(id => accountIdentifiers.includes(id));
  if (!hasMatch) {
    console.error('❌ Recovery methods do not match account');
    return null;
  }

  try {
    // Generate recovery password
    const password = generateRecoveryPassword(accountIdentifiers);

    // Decrypt seed
    const secret = await decryptSeed(accountData.encryptedSeed, password);

    // Recreate keypair
    const keypair = Keypair.fromSecret(secret);

    console.log('✅ Account recovered:', accountData.stellarAddress);
    return {
      keypair,
      address: accountData.stellarAddress
    };
  } catch (error) {
    console.error('❌ Failed to decrypt recovery data:', error);
    return null;
  }
}

/**
 * Add recovery method to existing account
 */
export async function addRecoveryMethod(
  stellarAddress: string,
  method: RecoveryMethod,
  keypairSecret: string
): Promise<boolean> {
  const existing = getRecoveryData(stellarAddress);

  if (!existing) {
    console.error('❌ Account not found');
    return false;
  }

  // Check if method already exists
  const exists = existing.recoveryMethods.some(
    m => m.type === method.type && m.identifier === method.identifier
  );

  if (exists) {
    console.log('⚠️ Recovery method already exists');
    return true;
  }

  // Add new method
  const updatedMethods = [...existing.recoveryMethods, method];

  // Re-encrypt with new recovery password
  await saveRecoveryData(
    stellarAddress,
    existing.primaryIdentifier,
    updatedMethods,
    keypairSecret
  );

  console.log('✅ Recovery method added:', method.type);
  return true;
}

/**
 * Remove recovery method
 */
export async function removeRecoveryMethod(
  stellarAddress: string,
  type: string,
  identifier: string,
  keypairSecret: string
): Promise<boolean> {
  const existing = getRecoveryData(stellarAddress);

  if (!existing) {
    return false;
  }

  // Filter out the method
  const updatedMethods = existing.recoveryMethods.filter(
    m => !(m.type === type && m.identifier === identifier)
  );

  if (updatedMethods.length === existing.recoveryMethods.length) {
    console.log('⚠️ Recovery method not found');
    return false;
  }

  // Re-encrypt with updated methods
  await saveRecoveryData(
    stellarAddress,
    existing.primaryIdentifier,
    updatedMethods,
    keypairSecret
  );

  console.log('✅ Recovery method removed:', type);
  return true;
}

/**
 * List recovery methods for account
 */
export function listRecoveryMethods(stellarAddress: string): RecoveryMethod[] {
  const data = getRecoveryData(stellarAddress);
  return data ? data.recoveryMethods : [];
}
