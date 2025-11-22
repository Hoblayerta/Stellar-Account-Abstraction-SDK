/**
 * SEP-30 Recovery Server Types
 */

export interface RecoveryIdentity {
  type: 'email' | 'github' | 'stellar_address';
  value: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface RecoverySigner {
  publicKey: string;
  weight: number;
  addedAt: string;
}

export interface AccountRecord {
  stellarAddress: string;
  encryptedSignerKey: string;
  encryptionSalt: string;
  identities: RecoveryIdentity[];
  createdAt: string;
  lastRecoveryAttempt?: string;
}

export interface RegisterAccountRequest {
  address: string;
  identities: RecoveryIdentity[];
}

export interface VerifyIdentityRequest {
  address: string;
  identity: {
    type: string;
    value: string;
  };
  proof: {
    code?: string;        // For email
    token?: string;       // For OAuth
  };
}

export interface SignTransactionRequest {
  address: string;
  transactionXDR: string;
  verifiedIdentities: Array<{
    type: string;
    value: string;
  }>;
}

export interface RecoveryAttempt {
  id: number;
  stellarAddress: string;
  identityType: string;
  identityValue: string;
  verified: boolean;
  ipAddress?: string;
  createdAt: string;
}
