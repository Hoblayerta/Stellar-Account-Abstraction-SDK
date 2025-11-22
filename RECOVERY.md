# SEP-30 Account Recovery Implementation

This project implements SEP-30 compliant account recovery for Stellar Social Wallet using Email and GitHub OAuth as recovery methods.

## Overview

SEP-30 enables multi-party account recovery, allowing users to regain access to their Stellar accounts if they lose their device or private keys. This implementation provides:

- **Email Recovery**: Magic link/code verification via email
- **GitHub OAuth**: OAuth-based recovery for developers
- **Multi-signature Setup**: Configurable thresholds and signer weights
- **Recovery Server Integration**: Framework for production SEP-30 recovery servers

## Architecture

### Components

```
stellar-social-sdk/
├── src/
│   ├── types/recovery.ts              # SEP-30 type definitions
│   ├── providers/
│   │   ├── EmailRecoveryProvider.ts   # Email recovery implementation
│   │   └── GitHubRecoveryProvider.ts  # GitHub OAuth recovery
│   └── auth/StellarSocialAccount.ts   # Recovery signer management
└── ...

demo-app/
├── src/app/recovery/page.tsx          # Recovery UI
└── ...
```

### Recovery Flow

```
1. Setup Phase
   ├─ User registers recovery identities
   ├─ Recovery servers generate encrypted signing keys
   └─ Account signers and thresholds configured

2. Normal Operations
   └─ User operates account with device key (weight 2)

3. Recovery Phase (Device Lost)
   ├─ User authenticates with recovery methods (email/GitHub)
   ├─ Recovery servers verify identity
   ├─ Servers sign transaction to replace device key
   └─ User submits multi-signed transaction
```

## SEP-30 Compliance

### Recovery Configuration

Default configuration follows SEP-30 best practices:

```typescript
{
  accountThreshold: {
    low: 2,    // Requires 2 signature weight
    medium: 2,
    high: 2
  },
  signerWeight: {
    device: 2,           // Device key has weight 2
    recoveryServer: 1    // Each recovery server has weight 1
  },
  servers: [
    { endpoint: 'https://recovery1.example.com', signerWeight: 1 },
    { endpoint: 'https://recovery2.example.com', signerWeight: 1 }
  ]
}
```

**Security Model:**
- Device alone can sign (weight 2 ≥ threshold 2)
- Both recovery servers needed without device (1 + 1 = 2 ≥ threshold 2)
- Single compromised recovery server cannot control account

### Identity Types

Supports SEP-30 standard identity types:

- `email` - Email addresses (RFC 5322)
- `phone_number` - E.164 format (+[country][number])
- `stellar_address` - Stellar public keys (G...)

### API Endpoints (Production)

SEP-30 defines these recovery server endpoints:

```
POST   /accounts/{address}                    # Register account
PUT    /accounts/{address}                    # Update identities
POST   /accounts/{address}/sign/{signer}      # Sign recovery transaction
GET    /accounts/{address}                    # Get account info
DELETE /accounts/{address}                    # Delete account
GET    /accounts                              # List accounts
```

## Recovery Methods

### Email Recovery

**Setup:**
```typescript
import { EmailRecoveryProvider } from 'stellar-social-sdk';

const emailProvider = new EmailRecoveryProvider();

// Send verification code
await emailProvider.sendRecoveryCode({ email: 'user@example.com' });

// Verify code
const verified = await emailProvider.verifyRecoveryCode({
  email: 'user@example.com',
  code: '123456'
});

// Create SEP-30 auth method
const authMethod = emailProvider.createAuthMethod('user@example.com');
```

**Features:**
- 6-digit verification codes
- Demo mode with console logging
- Production-ready email API integration points
- E.164 phone number support (future)

### GitHub OAuth Recovery

**Setup:**
```typescript
import { GitHubRecoveryProvider } from 'stellar-social-sdk';

const githubProvider = new GitHubRecoveryProvider(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET
);

// Initiate OAuth flow
githubProvider.initiateOAuth('http://localhost:3000/recovery/callback');

// Exchange code for token
const token = await githubProvider.exchangeCodeForToken({
  code: authCode,
  redirectUri: redirectUri
});

// Get user info
const userInfo = await githubProvider.getUserInfo(token);

// Create SEP-30 auth method
const authMethod = githubProvider.createAuthMethod(userInfo);
```

**Features:**
- Standard OAuth 2.0 flow
- CSRF protection with state parameter
- Primary email detection
- Stable user ID-based identifiers

## Account Setup

### Register Recovery Identity

```typescript
import { RecoveryIdentity } from 'stellar-social-sdk';

const identity: RecoveryIdentity = {
  role: 'owner',
  authMethods: [
    { type: 'email', value: 'user@example.com' },
    { type: 'stellar_address', value: 'GXXXXX...' }
  ]
};

await account.registerRecoveryIdentity(identity);
```

### Add Recovery Signers

```typescript
import { RecoveryConfig } from 'stellar-social-sdk';

const config: RecoveryConfig = {
  accountThreshold: { low: 2, medium: 2, high: 2 },
  signerWeight: { device: 2, recoveryServer: 1 },
  servers: [
    { endpoint: 'https://recovery1.example.com', signerWeight: 1 },
    { endpoint: 'https://recovery2.example.com', signerWeight: 1 }
  ]
};

await account.addRecoverySigner(config);
```

This creates a transaction that:
1. Sets account thresholds
2. Adds recovery server signers
3. Updates device key weight

## Recovery Process

### Initiate Recovery

```typescript
import { Keypair } from '@stellar/stellar-sdk';

// Generate new device keypair
const newDeviceKeypair = Keypair.random();

// Authenticate with recovery methods
const recoveryAuthMethods = [
  { type: 'email', value: 'user@example.com' }
];

// Initiate recovery
await account.initiateRecovery(
  newDeviceKeypair,
  recoveryAuthMethods
);
```

### Complete Recovery (Production)

In production, recovery servers would:
1. Verify authentication (email code, OAuth token)
2. Build transaction to replace device key
3. Sign transaction with recovery signer
4. Return signed XDR

```typescript
// Submit multi-signed transaction from recovery servers
const txHash = await account.completeRecovery(signedTransactionXDR);
```

## Demo App Usage

### Access Recovery UI

1. Login to wallet at `http://localhost:3000`
2. Click "🛡️ Setup Recovery" button
3. Navigate to recovery setup page

### Email Recovery Demo

1. Enter email address
2. Click "Setup Email Recovery"
3. Note the 6-digit code displayed (in production, sent via email)
4. Enter verification code
5. Confirm registration

### GitHub Recovery Setup (REAL OAuth - Production Ready)

**1. Create GitHub OAuth Application:**
```bash
# Go to: https://github.com/settings/developers
# Click "New OAuth App"
# Fill in:
#   Application name: Stellar Social Wallet
#   Homepage URL: http://localhost:3000 (or your domain)
#   Authorization callback URL: http://localhost:3000/recovery/github/callback
# Click "Register application"
# Copy Client ID and generate Client Secret
```

**2. Configure Environment Variables:**
```bash
# In demo-app/.env.local
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

**3. Test OAuth Flow:**
```bash
cd demo-app
npm run dev

# Navigate to http://localhost:3000/recovery
# Click "Setup GitHub Recovery"
# Authorize with GitHub
# You'll be redirected back with authenticated user info
```

**Security Features:**
- ✅ Server-side token exchange (client_secret never exposed)
- ✅ CSRF protection with state parameter
- ✅ Secure session storage
- ✅ Production-ready OAuth 2.0 flow

**For Production:**
Update callback URL to your domain:
```
https://yourdomain.com/recovery/github/callback
```

## Environment Variables

```bash
# Required for Google auth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Optional for GitHub recovery
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_secret

# Optional for production recovery server
NEXT_PUBLIC_RECOVERY_SERVER_URL=https://recovery.example.com
```

## Production Deployment

### Recovery Server Requirements

A production SEP-30 recovery server must:

1. **Generate Signing Keys**: Create unique encrypted signing keys per account
2. **Verify Identities**: Validate email codes, OAuth tokens, etc.
3. **Store Encrypted Keys**: Securely store encrypted signing keys
4. **Sign Transactions**: Sign recovery transactions after authentication
5. **Rate Limiting**: Prevent abuse of recovery endpoints
6. **Audit Logging**: Log all recovery attempts

### Security Considerations

**Key Management:**
- Recovery server signing keys must be encrypted at rest
- Use HSM or KMS for production key storage
- Implement key rotation policies

**Authentication:**
- Email: Use secure SMTP with SPF/DKIM
- OAuth: Validate tokens with provider APIs
- Rate limit verification attempts

**Multi-Party Recovery:**
- Deploy multiple independent recovery servers
- Geographic distribution for resilience
- No single server should control account

### Recommended Configuration

For production accounts:

```typescript
{
  accountThreshold: { low: 3, medium: 3, high: 3 },
  signerWeight: {
    device: 3,           // Full control
    recoveryServer: 2    // Need 2 servers without device
  },
  servers: [
    { endpoint: 'https://recovery-us.example.com', signerWeight: 2 },
    { endpoint: 'https://recovery-eu.example.com', signerWeight: 2 }
  ]
}
```

This ensures:
- Device has full control (weight 3)
- Both recovery servers needed without device (2 + 2 = 4 ≥ 3)
- Single server compromise cannot recover account

## API Reference

### EmailRecoveryProvider

```typescript
class EmailRecoveryProvider {
  constructor(apiEndpoint?: string);

  sendRecoveryCode(request: EmailRecoveryRequest): Promise<{
    success: boolean;
    error?: string;
  }>;

  verifyRecoveryCode(verification: EmailRecoveryVerification): Promise<boolean>;

  createAuthMethod(email: string): RecoveryAuthMethod;

  getPendingCode(email: string): string | undefined; // Demo only
}
```

### GitHubRecoveryProvider

```typescript
class GitHubRecoveryProvider {
  constructor(clientId: string, clientSecret?: string);

  getAuthorizationUrl(redirectUri: string, state?: string): string;

  exchangeCodeForToken(request: GitHubRecoveryRequest): Promise<string>;

  getUserInfo(accessToken: string): Promise<GitHubUserInfo>;

  createAuthMethod(userInfo: GitHubUserInfo): RecoveryAuthMethod;

  initiateOAuth(redirectUri: string): void;

  verifyState(state: string): boolean;
}
```

### StellarSocialAccount Recovery Methods

```typescript
class StellarSocialAccount {
  // Register recovery identity
  registerRecoveryIdentity(identity: RecoveryIdentity): Promise<boolean>;

  // Add recovery signers
  addRecoverySigner(config: RecoveryConfig): Promise<boolean>;

  // Initiate account recovery
  initiateRecovery(
    newDeviceKeypair: Keypair,
    recoveryAuthMethods: RecoveryAuthMethod[]
  ): Promise<boolean>;

  // Complete recovery with signed transaction
  completeRecovery(signedTransactionXDR: string): Promise<string>;

  // Get registered recovery identities
  getRecoveryIdentities(): RecoveryIdentity[];

  // Get recovery signers
  getRecoverySigners(): RecoverySigner[];
}
```

## Testing

### Manual Testing

1. **Setup Recovery:**
   - Create account via Google login
   - Navigate to recovery page
   - Setup email recovery
   - Verify code registration

2. **Simulate Device Loss:**
   - Clear browser storage
   - Attempt recovery flow
   - Verify new device key generation

3. **Multi-Server Recovery:**
   - Configure multiple recovery servers
   - Verify threshold enforcement
   - Test partial signature scenarios

### Integration Tests

```typescript
// Example test flow
const account = await sdk.authenticateWithGoogleCredential(credential);

// Setup recovery
const identity: RecoveryIdentity = {
  role: 'owner',
  authMethods: [{ type: 'email', value: 'test@example.com' }]
};
await account.registerRecoveryIdentity(identity);

// Add signers
const config: RecoveryConfig = { /* ... */ };
await account.addRecoverySigner(config);

// Verify signers added
const signers = account.getRecoverySigners();
expect(signers).toHaveLength(2);
```

## Resources

- **SEP-30 Specification**: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0030.md
- **Stellar Developer Docs**: https://developers.stellar.org/docs/build/apps/wallet/sep30
- **Demo Implementation**: `/demo-app/src/app/recovery/page.tsx`
- **SDK Source**: `/stellar-social-sdk/src/providers/`

## Future Enhancements

- [ ] Phone SMS recovery implementation
- [ ] Biometric recovery methods
- [ ] Recovery server reference implementation
- [ ] Multi-language support for recovery emails
- [ ] Recovery analytics dashboard
- [ ] Automated testing suite
- [ ] Recovery simulation tools

## Support

For questions or issues:
- Open issue on GitHub
- Check SEP-30 specification
- Review Stellar developer documentation
- Examine demo app implementation
