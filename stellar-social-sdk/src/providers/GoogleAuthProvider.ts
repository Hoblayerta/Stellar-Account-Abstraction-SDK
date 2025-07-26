import { AuthMethod } from '../types/index.js';
import { CryptoUtils } from '../utils/crypto.js';

export class GoogleAuthProvider {
  private clientId?: string;

  constructor(clientId?: string) {
    this.clientId = clientId;
  }

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    console.log('🔧 Initializing Google Auth Provider');
  }

  async authenticate(): Promise<AuthMethod> {
    console.log('🔐 Authenticating with Google (MVP Mock)');
    
    // Mock Google user for MVP testing
    const mockGoogleUser = {
      sub: `google_${Date.now()}`,
      email: `user${Math.floor(Math.random() * 1000)}@gmail.com`,
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
    };

    return {
      type: 'google',
      identifier: mockGoogleUser.email,
      token: 'mock_google_token_' + Date.now(),
      metadata: {
        name: mockGoogleUser.name,
        picture: mockGoogleUser.picture,
        sub: mockGoogleUser.sub
      }
    };
  }

  async verifyToken(token: string): Promise<any> {
    // For MVP, return mock verification
    if (token.startsWith('mock_google_token')) {
      return {
        sub: 'google_123456789',
        email: 'user@gmail.com',
        name: 'Test User',
        iss: 'accounts.google.com',
        aud: this.clientId
      };
    }
    throw new Error('Invalid Google token');
  }

  generateSeed(googleId: string): string {
    return CryptoUtils.generateSeed('google', googleId);
  }
}
