import { AuthMethod } from '../types/index.js';
import { CryptoUtils } from '../utils/crypto.js';

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

export class GoogleAuthProvider {
  private clientId: string;
  private initialized = false;

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error('Google Client ID is required');
    }
    this.clientId = clientId;
  }

  /**
   * Initialize Google Identity Services
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;
    
    console.log('🔧 Initializing Google Identity Services...');
    
    // Load Google Identity Services
    await this.loadGoogleIdentityServices();
    
    // Initialize Google Sign-In
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: this.handleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      
      this.initialized = true;
      console.log('✅ Google Identity Services initialized');
    } else {
      throw new Error('Failed to load Google Identity Services');
    }
  }

  /**
   * Load Google Identity Services script
   */
  private loadGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      
      document.head.appendChild(script);
    });
  }

  /**
   * Handle Google credential response
   */
  private handleCredentialResponse(response: any) {
    if (window.handleGoogleCredential) {
      window.handleGoogleCredential(response);
    }
  }

  /**
   * Authenticate with Google - Real OAuth flow
   */
  async authenticate(): Promise<AuthMethod> {
    if (!this.initialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      // Set up global callback handler
      window.handleGoogleCredential = async (response: any) => {
        try {
          const userInfo = await this.verifyToken(response.credential);
          
          const authMethod: AuthMethod = {
            type: 'google',
            identifier: userInfo.email,
            token: response.credential,
            metadata: {
              name: userInfo.name,
              picture: userInfo.picture,
              sub: userInfo.sub,
              email: userInfo.email,
              email_verified: userInfo.email_verified,
            }
          };

          console.log('✅ Google authentication successful:', userInfo.email);
          resolve(authMethod);
        } catch (error: any) {
          console.error('❌ Google authentication failed:', error);
          reject(error);
        }
      };

      // Trigger Google Sign-In
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      } else {
        reject(new Error('Google Identity Services not loaded'));
      }
    });
  }

  /**
   * Render Google Sign-In button
   */
  renderButton(element: Element, config: any = {}): void {
    if (!this.initialized || !window.google?.accounts?.id) {
      throw new Error('Google Identity Services not initialized');
    }

    const defaultConfig = {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'signin_with',
      size: 'large',
      logo_alignment: 'left',
      width: '100%',
    };

    window.google.accounts.id.renderButton(element, { ...defaultConfig, ...config });
  }

  /**
   * Verify Google JWT token
   */
  async verifyToken(token: string): Promise<any> {
    try {
      // Decode JWT without verification (for demo purposes)
      // In production, verify signature with Google's public keys
      const payload = this.decodeJWT(token);
      
      // Basic validation
      if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new Error('Invalid token issuer');
      }
      
      if (payload.aud !== this.clientId) {
        throw new Error('Invalid token audience');
      }
      
      if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error: any) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Decode JWT token (basic decoding)
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to decode JWT');
    }
  }

  /**
   * Generate deterministic seed from Google user ID
   */
  generateSeed(googleSub: string): string {
    return CryptoUtils.generateSeed('google', googleSub);
  }

  /**
   * Sign out from Google
   */
  signOut(): void {
    if (window.google?.accounts?.id) {
      // Google Identity Services doesn't have direct sign out
      // We'll handle this in the app level
      console.log('Google sign out requested');
    }
  }
}
