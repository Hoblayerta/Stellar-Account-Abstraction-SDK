/**
 * SEP-30 Account Recovery Types
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0030.md
 */
export type RecoveryIdentityType = 'stellar_address' | 'phone_number' | 'email';
export interface RecoveryIdentity {
    role: 'owner' | 'other';
    authMethods: RecoveryAuthMethod[];
    authenticated?: boolean;
}
export interface RecoveryAuthMethod {
    type: RecoveryIdentityType;
    value: string;
}
export interface RecoverySigner {
    key: string;
    added?: string;
}
export interface RecoveryAccountInfo {
    address: string;
    identities: RecoveryIdentity[];
    signers: RecoverySigner[];
}
export interface RecoveryServerConfig {
    endpoint: string;
    signerWeight: number;
}
export interface RecoveryConfig {
    accountThreshold: {
        low: number;
        medium: number;
        high: number;
    };
    signerWeight: {
        device: number;
        recoveryServer: number;
    };
    servers: RecoveryServerConfig[];
}
export interface EmailRecoveryRequest {
    email: string;
}
export interface EmailRecoveryVerification {
    email: string;
    code: string;
}
export interface GitHubRecoveryRequest {
    code: string;
    redirectUri: string;
}
export interface RecoveryResult {
    success: boolean;
    newKeypair?: {
        publicKey: string;
        secret: string;
    };
    error?: string;
}
