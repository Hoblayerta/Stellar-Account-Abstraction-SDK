import { Horizon, Keypair, Asset } from '@stellar/stellar-sdk';

interface SocialAuthConfig {
    contractId: string;
    network: 'testnet' | 'mainnet';
    horizonUrl?: string;
    googleClientId?: string;
    facebookAppId?: string;
}
interface AuthMethod {
    type: 'google' | 'facebook' | 'phone' | 'passkey' | 'freighter';
    identifier: string;
    token?: string;
    metadata?: Record<string, any>;
}
interface SocialAccountData {
    publicKey: string;
    authMethods: AuthMethod[];
    createdAt: number;
    recoveryContacts: string[];
}
interface AuthResult {
    success: boolean;
    account?: any;
    error?: string;
}
interface PhoneVerification {
    phoneNumber: string;
    verificationCode: string;
}
declare global {
    interface Window {
        freighter?: {
            requestAccess(): Promise<{
                publicKey: string;
            }>;
            signTransaction(txn: string, network: string): Promise<{
                signedTxn: string;
            }>;
            getNetwork(): Promise<{
                network: string;
                networkPassphrase: string;
            }>;
        };
    }
}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    prompt: () => void;
                    renderButton: (element: Element, config: any) => void;
                };
            };
        };
        handleGoogleCredential?: (response: any) => void;
    }
}
declare class GoogleAuthProvider {
    private clientId;
    private initialized;
    constructor(clientId: string);
    /**
     * Initialize Google Identity Services (only load script, don't initialize)
     */
    initialize(): Promise<void>;
    /**
     * Load Google Identity Services script
     */
    private loadGoogleIdentityServices;
    /**
     * Handle Google credential response
     */
    private handleCredentialResponse;
    /**
     * Create AuthMethod from Google credential response
     */
    createAuthMethodFromCredential(credentialResponse: any): Promise<AuthMethod>;
    /**
     * Authenticate with Google - Real OAuth flow (deprecated, use createAuthMethodFromCredential)
     */
    authenticate(): Promise<AuthMethod>;
    /**
     * Render Google Sign-In button
     */
    renderButton(element: Element, config?: any): void;
    /**
     * Verify Google JWT token with enhanced validation
     */
    verifyToken(token: string): Promise<any>;
    /**
     * Decode JWT token (basic decoding)
     */
    private decodeJWT;
    /**
     * Generate deterministic seed from Google user ID
     */
    generateSeed(googleSub: string): string;
    /**
     * Sign out from Google
     */
    signOut(): void;
}

/**
 * SEP-30 Account Recovery Types
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0030.md
 */
type RecoveryIdentityType = 'stellar_address' | 'phone_number' | 'email';
interface RecoveryIdentity {
    role: 'owner' | 'other';
    authMethods: RecoveryAuthMethod[];
    authenticated?: boolean;
}
interface RecoveryAuthMethod {
    type: RecoveryIdentityType;
    value: string;
}
interface RecoverySigner {
    key: string;
    added?: string;
}
interface RecoveryAccountInfo {
    address: string;
    identities: RecoveryIdentity[];
    signers: RecoverySigner[];
}
interface RecoveryServerConfig {
    endpoint: string;
    signerWeight: number;
}
interface RecoveryConfig {
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
interface EmailRecoveryRequest {
    email: string;
}
interface EmailRecoveryVerification {
    email: string;
    code: string;
}
interface GitHubRecoveryRequest {
    code: string;
    redirectUri: string;
}
interface RecoveryResult {
    success: boolean;
    newKeypair?: {
        publicKey: string;
        secret: string;
    };
    error?: string;
}

declare class StellarSocialAccount {
    private keypair?;
    private server;
    private contractId;
    private network;
    data: SocialAccountData;
    private recoverySigners;
    private recoveryIdentities;
    constructor(data: SocialAccountData, server: Horizon.Server, contractId: string, network: string, keypair?: Keypair);
    get publicKey(): string;
    get authMethods(): AuthMethod[];
    /**
     * Send payment to another account
     */
    sendPayment(destination: string, amount: string, asset?: Asset, memo?: string): Promise<string>;
    /**
     * Send gasless payment - El sponsor paga las fees
     * @param destination Dirección de destino
     * @param amount Cantidad a enviar
     * @param sponsorApiUrl URL del API endpoint del sponsor (default: /api/sponsor-transaction)
     * @param asset Asset a enviar (default: XLM nativo)
     * @param memo Memo opcional
     */
    sendGaslessPayment(destination: string, amount: string, sponsorApiUrl?: string, asset?: Asset, memo?: string): Promise<{
        hash: string;
        sponsorPublicKey: string;
    }>;
    /**
     * Add new authentication method - Simplified for MVP
     */
    addAuthMethod(newMethod: AuthMethod): Promise<boolean>;
    /**
     * Get account balance
     */
    getBalance(): Promise<{
        balance: string;
        asset: string;
    }[]>;
    /**
     * Initialize account with contract (for new accounts)
     */
    initializeWithContract(): Promise<boolean>;
    /**
     * SEP-30: Register recovery identities
     */
    registerRecoveryIdentity(identity: RecoveryIdentity): Promise<boolean>;
    /**
     * SEP-30: Add recovery signer
     */
    addRecoverySigner(config: RecoveryConfig): Promise<boolean>;
    /**
     * SEP-30: Initiate account recovery
     */
    initiateRecovery(newDeviceKeypair: Keypair, recoveryAuthMethods: RecoveryAuthMethod[]): Promise<boolean>;
    /**
     * SEP-30: Complete account recovery
     */
    completeRecovery(signedTransactionXDR: string): Promise<string>;
    /**
     * Get recovery identities
     */
    getRecoveryIdentities(): RecoveryIdentity[];
    /**
     * Get recovery signers
     */
    getRecoverySigners(): RecoverySigner[];
    /**
     * Validate recovery auth method
     */
    private isValidAuthMethod;
    private isValidEmail;
    private isValidPhone;
    private isValidStellarAddress;
}

declare class EmailRecoveryProvider {
    private apiEndpoint;
    private pendingVerifications;
    constructor(apiEndpoint?: string);
    /**
     * Send recovery code to email
     */
    sendRecoveryCode(request: EmailRecoveryRequest): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify recovery code
     */
    verifyRecoveryCode(verification: EmailRecoveryVerification): Promise<boolean>;
    /**
     * Create SEP-30 auth method from verified email
     */
    createAuthMethod(email: string): RecoveryAuthMethod;
    /**
     * Generate 6-digit recovery code
     */
    private generateCode;
    /**
     * Get pending code for demo/testing
     */
    getPendingCode(email: string): string | undefined;
}

interface GitHubUserInfo {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
}
declare class GitHubRecoveryProvider {
    private clientId;
    private clientSecret?;
    constructor(clientId: string, clientSecret?: string);
    /**
     * Get GitHub OAuth authorization URL
     */
    getAuthorizationUrl(redirectUri: string, state?: string): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(request: GitHubRecoveryRequest): Promise<string>;
    /**
     * Get GitHub user info using access token
     */
    getUserInfo(accessToken: string): Promise<GitHubUserInfo>;
    /**
     * Get primary email from GitHub (when not public)
     */
    private getPrimaryEmail;
    /**
     * Create SEP-30 auth method from GitHub user info
     */
    createAuthMethod(userInfo: GitHubUserInfo): RecoveryAuthMethod;
    /**
     * Generate deterministic identifier for GitHub user
     */
    generateIdentifier(userInfo: GitHubUserInfo): string;
    /**
     * Initiate OAuth flow (client-side)
     */
    initiateOAuth(redirectUri: string): void;
    /**
     * Generate random state for OAuth CSRF protection
     */
    private generateState;
    /**
     * Verify OAuth state (CSRF protection)
     */
    verifyState(state: string): boolean;
}

declare const DEFAULT_CONTRACT_ID = "CALZGCSB3P3WEBLW3QTF5Y4WEALEVTYUYBC7KBGQ266GDINT7U4E74KW";

declare class StellarSocialSDK {
    private server;
    private contractId;
    private network;
    googleProvider?: GoogleAuthProvider;
    private freighterProvider;
    constructor(config: SocialAuthConfig);
    /**
     * Initialize SDK (load external scripts, etc.)
     */
    initialize(): Promise<void>;
    /**
     * Authenticate with Google using credential response - REAL OAuth
     */
    authenticateWithGoogleCredential(credentialResponse: any): Promise<AuthResult>;
    /**
     * Authenticate with Google - DEPRECATED, use authenticateWithGoogleCredential
     */
    authenticateWithGoogle(): Promise<AuthResult>;
    /**
     * Authenticate with Facebook (mock for MVP)
     */
    authenticateWithFacebook(): Promise<AuthResult>;
    /**
     * Authenticate with phone number
     */
    authenticateWithPhone(verification: PhoneVerification): Promise<AuthResult>;
    /**
     * Connect Freighter wallet
     */
    connectFreighter(): Promise<AuthResult>;
    /**
     * Get or create account for auth method
     */
    private getOrCreateAccount;
    /**
     * Get or create account with specific keypair
     */
    private getOrCreateAccountWithKeypair;
    /**
     * Create new Stellar account
     */
    private createNewAccount;
    /**
     * Create new account with specific keypair
     */
    private createNewAccountWithKeypair;
    /**
     * Fund testnet account using friendbot
     */
    private fundTestnetAccount;
    /**
     * Load existing account if it exists
     */
    private loadExistingAccount;
}

export { DEFAULT_CONTRACT_ID, EmailRecoveryProvider, GitHubRecoveryProvider, StellarSocialAccount, StellarSocialSDK };
export type { AuthMethod, AuthResult, EmailRecoveryRequest, EmailRecoveryVerification, GitHubRecoveryRequest, GitHubUserInfo, PhoneVerification, RecoveryAccountInfo, RecoveryAuthMethod, RecoveryConfig, RecoveryIdentity, RecoveryIdentityType, RecoveryResult, RecoveryServerConfig, RecoverySigner, SocialAccountData, SocialAuthConfig };
