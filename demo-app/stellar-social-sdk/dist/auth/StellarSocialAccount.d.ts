import { Keypair, Horizon, Asset } from '@stellar/stellar-sdk';
import { AuthMethod, SocialAccountData } from '../types/index.js';
export declare class StellarSocialAccount {
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
}
