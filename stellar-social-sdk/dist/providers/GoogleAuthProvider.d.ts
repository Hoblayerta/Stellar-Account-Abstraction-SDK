import { AuthMethod } from '../types/index.js';
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
export declare class GoogleAuthProvider {
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
