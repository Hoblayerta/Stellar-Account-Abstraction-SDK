import { GitHubRecoveryRequest, RecoveryAuthMethod } from '../types/recovery.js';

export interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export class GitHubRecoveryProvider {
  private clientId: string;
  private clientSecret?: string;

  constructor(clientId: string, clientSecret?: string) {
    if (!clientId) {
      throw new Error('GitHub Client ID is required');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get GitHub OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(request: GitHubRecoveryRequest): Promise<string> {
    try {
      console.log('🔄 Exchanging GitHub code for token...');

      // In browser environment, this should be done server-side to protect client_secret
      // For demo, we'll use GitHub's OAuth API directly
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: request.code,
          redirect_uri: request.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
      }

      console.log('✅ GitHub token obtained');
      return data.access_token;
    } catch (error: any) {
      console.error('❌ Token exchange failed:', error.message);
      throw error;
    }
  }

  /**
   * Get GitHub user info using access token
   */
  async getUserInfo(accessToken: string): Promise<GitHubUserInfo> {
    try {
      console.log('👤 Fetching GitHub user info...');

      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const userInfo = await response.json();
      console.log('✅ GitHub user info obtained:', userInfo.login);

      // If primary email is not public, fetch emails separately
      if (!userInfo.email) {
        userInfo.email = await this.getPrimaryEmail(accessToken);
      }

      return userInfo;
    } catch (error: any) {
      console.error('❌ Failed to get user info:', error.message);
      throw error;
    }
  }

  /**
   * Get primary email from GitHub (when not public)
   */
  private async getPrimaryEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const emails = await response.json();
      const primaryEmail = emails.find((e: any) => e.primary && e.verified);
      return primaryEmail?.email || null;
    } catch {
      return null;
    }
  }

  /**
   * Create SEP-30 auth method from GitHub user info
   */
  createAuthMethod(userInfo: GitHubUserInfo): RecoveryAuthMethod {
    // Use GitHub user ID as the identifier (more stable than email)
    return {
      type: 'email', // SEP-30 doesn't have 'github', so we use email
      value: userInfo.email || `${userInfo.login}@users.noreply.github.com`
    };
  }

  /**
   * Generate deterministic identifier for GitHub user
   */
  generateIdentifier(userInfo: GitHubUserInfo): string {
    // Use GitHub ID for consistency (emails can change)
    return `github:${userInfo.id}`;
  }

  /**
   * Initiate OAuth flow (client-side)
   */
  initiateOAuth(redirectUri: string): void {
    if (typeof window === 'undefined') {
      throw new Error('OAuth flow can only be initiated in browser environment');
    }

    const state = this.generateState();
    const authUrl = this.getAuthorizationUrl(redirectUri, state);

    // Store state for verification
    sessionStorage.setItem('github_oauth_state', state);

    // Redirect to GitHub
    window.location.href = authUrl;
  }

  /**
   * Generate random state for OAuth CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify OAuth state (CSRF protection)
   */
  verifyState(state: string): boolean {
    if (typeof window === 'undefined') return false;

    const storedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');

    return storedState === state;
  }
}
