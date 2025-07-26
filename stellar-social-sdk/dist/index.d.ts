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
    private googleProvider?;
    private freighterProvider;
    constructor(config: SocialAuthConfig);
    /**
     * Initialize SDK (load external scripts, etc.)
     */
    initialize(): Promise<void>;
    /**
     * Authenticate with Google
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
     * Create new Stellar account
     */
    private createNewAccount;
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
