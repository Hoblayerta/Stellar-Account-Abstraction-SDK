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

declare class StellarSocialAccount {
    private keypair?;
    private server;
    private contractId;
    private network;
    data: SocialAccountData;
    constructor(data: SocialAccountData, server: Horizon.Server, contractId: string, network: string, keypair?: Keypair);
    get publicKey(): string;
    get authMethods(): AuthMethod[];
    /**
     * Send payment to another account
     */
    sendPayment(destination: string, amount: string, asset?: Asset, memo?: string): Promise<string>;
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

export { DEFAULT_CONTRACT_ID, StellarSocialAccount, StellarSocialSDK };
export type { AuthMethod, AuthResult, PhoneVerification, SocialAccountData, SocialAuthConfig };
