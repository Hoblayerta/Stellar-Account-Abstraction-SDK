import { AuthMethod } from '../types';
export declare class FreighterProvider {
    /**
     * Check if Freighter is installed
     */
    isInstalled(): boolean;
    /**
     * Connect to Freighter wallet
     */
    connect(): Promise<AuthMethod>;
    /**
     * Get current network from Freighter
     */
    getNetwork(): Promise<string>;
    /**
     * Sign transaction with Freighter
     */
    signTransaction(transaction: string, network: string): Promise<string>;
}
