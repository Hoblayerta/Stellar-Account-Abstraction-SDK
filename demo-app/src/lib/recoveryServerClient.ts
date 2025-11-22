/**
 * SEP-30 Recovery Server Client
 * Communicates with the recovery server for account registration and recovery
 */

const RECOVERY_SERVER_URL = process.env.NEXT_PUBLIC_RECOVERY_SERVER_URL || 'http://localhost:3001';

export interface RecoveryIdentity {
  type: 'email' | 'github' | 'phone';
  value: string;
  verified: boolean;
  metadata?: Record<string, any>;
}

export interface RegisterAccountResponse {
  address: string;
  identities: Array<{
    role: string;
    type: string;
    value: string;
  }>;
  signer: {
    key: string;
    weight: number;
  };
}

export interface AccountInfoResponse {
  address: string;
  identities: Array<{
    role: string;
    type: string;
    value: string;
    authenticated: boolean;
    metadata?: Record<string, any>;
  }>;
  signers: Array<{
    key: string;
    added: string;
  }>;
}

export interface SignRecoveryResponse {
  signature: string;
  signer: string;
}

/**
 * Register account with recovery identities on recovery server
 */
export async function registerAccount(
  stellarAddress: string,
  identities: RecoveryIdentity[]
): Promise<RegisterAccountResponse> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/accounts/${stellarAddress}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identities }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register account');
  }

  return response.json();
}

/**
 * Get account recovery information from recovery server
 */
export async function getAccountInfo(
  stellarAddress: string
): Promise<AccountInfoResponse> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/accounts/${stellarAddress}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Account not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to get account info');
  }

  return response.json();
}

/**
 * Update account identities on recovery server
 */
export async function updateAccountIdentities(
  stellarAddress: string,
  identities: RecoveryIdentity[]
): Promise<{ success: boolean; address: string }> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/accounts/${stellarAddress}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identities }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update account');
  }

  return response.json();
}

/**
 * Delete account from recovery server
 */
export async function deleteAccount(stellarAddress: string): Promise<{ success: boolean }> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/accounts/${stellarAddress}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete account');
  }

  return response.json();
}

/**
 * Sign recovery transaction with recovery server
 */
export async function signRecoveryTransaction(
  stellarAddress: string,
  signingAddress: string,
  transaction: string,
  verifiedIdentities: Array<{ type: string; value: string }>
): Promise<SignRecoveryResponse> {
  const response = await fetch(
    `${RECOVERY_SERVER_URL}/accounts/${stellarAddress}/sign/${signingAddress}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction,
        verifiedIdentities,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to sign transaction');
  }

  return response.json();
}

/**
 * Send email verification code
 */
export async function sendEmailVerification(
  email: string
): Promise<{ success: boolean; code?: string }> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/verify/email/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send verification');
  }

  return response.json();
}

/**
 * Verify email code
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ success: boolean; verified: boolean; identity: RecoveryIdentity }> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/verify/email/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify code');
  }

  return response.json();
}

/**
 * Verify GitHub OAuth token
 */
export async function verifyGitHubToken(
  token: string
): Promise<{ success: boolean; verified: boolean; identity: RecoveryIdentity }> {
  const response = await fetch(`${RECOVERY_SERVER_URL}/verify/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify GitHub token');
  }

  return response.json();
}
