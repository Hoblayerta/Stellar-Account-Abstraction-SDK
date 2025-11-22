import { Keypair, Horizon, Asset } from '@stellar/stellar-sdk';
import { AuthMethod, SocialAccountData } from '../types/index.js';
import { RecoveryConfig, RecoveryIdentity, RecoverySigner, RecoveryAuthMethod } from '../types/recovery.js';
export declare class StellarSocialAccount {
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
