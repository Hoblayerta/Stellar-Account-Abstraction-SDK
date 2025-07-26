import { Keypair } from '@stellar/stellar-sdk';
export declare class CryptoUtils {
    /**
     * Generate deterministic Stellar keypair from provider and identifier
     */
    static generateKeypair(provider: string, identifier: string, salt?: string): Keypair;
    /**
     * Generate deterministic seed string (legacy method)
     */
    static generateSeed(provider: string, identifier: string, salt?: string): string;
    /**
     * Verify JWT token structure (basic validation)
     */
    static isValidJWT(token: string): boolean;
    /**
     * Hash phone number for privacy
     */
    static hashPhone(phoneNumber: string): string;
    /**
     * Generate random keypair for testing
     */
    static randomKeypair(): Keypair;
}
