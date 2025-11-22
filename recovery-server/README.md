# SEP-30 Recovery Server

**Status**: ⚠️ Testnet Demo - NOT Production Ready

SEP-30-inspired recovery server for Stellar Social Wallet. Demonstrates account recovery concepts but requires significant work for production use.

## ⚠️ Important Limitations

This implementation is a **functional demo** for testnet that demonstrates SEP-30 concepts but has critical gaps:

### What Works
- ✅ Account registration with recovery identities
- ✅ Email verification with codes
- ✅ GitHub OAuth verification
- ✅ Encrypted signing key storage (AES-256-GCM)
- ✅ Transaction signing endpoint
- ✅ Rate limiting and basic security

### Critical Missing Features
- ❌ **SEP-10 Authentication** - No proof of account ownership
- ❌ **Transaction Validation** - Signs any transaction blindly
- ❌ **Complete Recovery Flow** - Demo stops at identity verification

**Do NOT use with real funds or mainnet.**

See [PRODUCTION_ROADMAP.md](../PRODUCTION_ROADMAP.md) for production requirements.

## Features (Current Implementation)

- SEP-30 standard compliant account recovery
- Multi-identity support (email, GitHub, phone)
- AES-256-GCM encrypted signing keys
- SQLite database with automatic cleanup
- Rate limiting and security hardening
- Email verification with codes
- GitHub OAuth integration
- Transaction signing for recovery

## Prerequisites

- Node.js 18+ and npm
- Stellar account for testnet/mainnet
- Environment variables configured

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set ENCRYPTION_KEY (min 32 characters)

# Run in development mode
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

Create `.env` file with:

```env
# Server
NODE_ENV=production
PORT=3001

# Security
ENCRYPTION_KEY=your-32-char-minimum-encryption-key-here

# Stellar
STELLAR_NETWORK=testnet  # or mainnet

# CORS
ALLOWED_ORIGINS=https://your-frontend.com,https://another-domain.com

# Database
DATABASE_PATH=./data/recovery.db
```

**IMPORTANT**: `ENCRYPTION_KEY` must be at least 32 characters and kept secret. Use a secure random string generator.

## Deployment to Render

### Option 1: Using render.yaml (Recommended)

1. Push code to GitHub repository
2. Connect repository to Render
3. Render will automatically detect `render.yaml`
4. Configure environment variables in Render dashboard:
   - `ENCRYPTION_KEY` (generate a secure random string)
   - `ALLOWED_ORIGINS` (your frontend URLs)
   - Other variables are pre-configured in render.yaml

### Option 2: Manual Setup

1. Create new Web Service on Render
2. Connect your repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Starter or higher
4. Add environment variables (see above)
5. Add persistent disk:
   - Name: `recovery-db`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1GB

### Post-Deployment

1. Verify health check: `https://your-app.onrender.com/health`
2. Update demo app with server URL
3. Test registration endpoint:

```bash
curl -X POST https://your-app.onrender.com/accounts/GXXXXX \
  -H "Content-Type: application/json" \
  -d '{
    "identities": [
      {"type": "email", "value": "user@example.com", "verified": true}
    ]
  }'
```

## API Endpoints

### Account Management

**POST /accounts/:address**
Register account with recovery identities

```json
{
  "identities": [
    {
      "type": "email",
      "value": "user@example.com",
      "verified": true
    }
  ]
}
```

**GET /accounts/:address**
Get account recovery information

**PUT /accounts/:address**
Update account identities

**DELETE /accounts/:address**
Delete account

**POST /accounts/:address/sign/:signing_address**
Sign recovery transaction

```json
{
  "transaction": "base64_xdr_transaction",
  "verifiedIdentities": [
    {"type": "email", "value": "user@example.com"}
  ]
}
```

### Identity Verification

**POST /verify/email/send**
Send verification code to email

```json
{
  "email": "user@example.com"
}
```

**POST /verify/email/check**
Verify email code

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**POST /verify/github**
Verify GitHub OAuth token

```json
{
  "token": "github_oauth_token"
}
```

## Security Features

- AES-256-GCM encryption for signing keys
- PBKDF2 key derivation (100,000 iterations)
- Rate limiting (100 requests/15min general, 10 verifications/hour)
- Helmet.js security headers
- CORS protection
- Input validation
- Automatic cleanup of expired codes

## Database Schema

- `accounts` - Stellar accounts with encrypted signing keys
- `identities` - Recovery identities per account
- `verification_codes` - Temporary email verification codes
- `recovery_attempts` - Audit log of recovery attempts

## Development Commands

```bash
npm run dev          # Development with auto-reload
npm run build        # Build TypeScript
npm start            # Production server
npm run db:migrate   # Run database migrations
```

## Testing

```bash
# Send verification code
curl -X POST http://localhost:3001/verify/email/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Register account
curl -X POST http://localhost:3001/accounts/GXXXXX \
  -H "Content-Type: application/json" \
  -d '{"identities":[{"type":"email","value":"test@example.com","verified":true}]}'

# Health check
curl http://localhost:3001/health
```

## Production Checklist

- [ ] `ENCRYPTION_KEY` is secure random string (32+ chars)
- [ ] `ALLOWED_ORIGINS` configured with frontend URLs
- [ ] Persistent disk configured for database
- [ ] Health check endpoint responding
- [ ] Rate limiting tested
- [ ] Email service integrated (currently demo mode)
- [ ] Monitoring/logging configured
- [ ] Backup strategy for database

## Email Integration

Current implementation logs codes to console (demo mode). For production:

1. Choose email service (SendGrid, AWS SES, Mailgun, etc.)
2. Update `src/routes/verify.ts:31` with actual email sending
3. Remove `code` from response in production

Example with SendGrid:

```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

await sgMail.send({
  to: email,
  from: 'noreply@yourdomain.com',
  subject: 'Recovery Verification Code',
  text: `Your verification code is: ${code}`
});
```

## Troubleshooting

**Database locked error**
- Ensure only one server instance is running
- Check file permissions on database

**ENCRYPTION_KEY error on startup**
- Verify ENCRYPTION_KEY is set and 32+ characters

**CORS errors**
- Add frontend URL to ALLOWED_ORIGINS
- Check protocol (http vs https)

**Rate limit errors**
- Adjust limits in src/index.ts
- Consider IP whitelisting for trusted sources

## License

MIT
