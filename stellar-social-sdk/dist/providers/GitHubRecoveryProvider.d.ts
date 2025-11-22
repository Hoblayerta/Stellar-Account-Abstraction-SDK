import { GitHubRecoveryRequest, RecoveryAuthMethod } from '../types/recovery.js';
export interface GitHubUserInfo {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
}
export declare class GitHubRecoveryProvider {
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
