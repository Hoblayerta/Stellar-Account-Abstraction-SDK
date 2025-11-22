# SEP-30 Recovery Server - Deployment Guide

## Quick Start

### 1. Local Development

```bash
cd recovery-server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and set ENCRYPTION_KEY (must be 32+ characters)
# Example: ENCRYPTION_KEY=my-super-secure-32-character-key-here-123456

# Run in development mode
npm run dev
```

Server will start on `http://localhost:3001`

### 2. Deploy to Render

#### Option A: Using render.yaml (Recommended)

1. **Push to GitHub**
   ```bash
   git add recovery-server/
   git commit -m "Add SEP-30 recovery server"
   git push origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml`

3. **Configure Environment Variables** (in Render dashboard)
   - `ENCRYPTION_KEY`: Click "Generate" for secure random value
   - `ALLOWED_ORIGINS`: Add your frontend URLs (comma-separated)
     - Example: `https://your-app.vercel.app,http://localhost:3000`
   - Other variables are pre-configured in `render.yaml`

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your service URL: `https://your-service-name.onrender.com`

#### Option B: Manual Setup

1. Create new Web Service on Render
2. Configure:
   - **Name**: `stellar-recovery-server`
   - **Environment**: Node
   - **Region**: Oregon (or closest to your users)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   STELLAR_NETWORK=testnet
   ENCRYPTION_KEY=<generate-secure-random-32-chars>
   ALLOWED_ORIGINS=https://your-frontend.com
   DATABASE_PATH=/opt/render/project/src/data/recovery.db
   ```
4. Add Disk:
   - **Name**: recovery-db
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB

### 3. Update Demo App

After deploying to Render:

1. **Update demo app environment**
   ```bash
   cd ../demo-app
   ```

2. **Edit `.env.local`** (or `.env.production` for production):
   ```env
   NEXT_PUBLIC_RECOVERY_SERVER_URL=https://your-service-name.onrender.com
   ```

3. **Redeploy demo app** with updated environment variable

### 4. Verify Deployment

Test the health endpoint:
```bash
curl https://your-service-name.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "uptime": 123.456
}
```

## Testing End-to-End

### 1. Register Account

From your demo app, create a new account and register recovery methods. This should:
- Create account on recovery server via `/api/recovery/register`
- Store encrypted signing key
- Save recovery identities (email, GitHub)

### 2. Verify Recovery Methods Work

Check registered methods:
```bash
curl https://your-recovery-server.onrender.com/accounts/GXXXXX
```

### 3. Test Email Verification

```bash
# Send code
curl -X POST https://your-recovery-server.onrender.com/verify/email/send \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Check logs for code (in development)
# In production, integrate with SendGrid/AWS SES

# Verify code
curl -X POST https://your-recovery-server.onrender.com/verify/email/check \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456"}'
```

## Production Checklist

Before going to production:

- [ ] Generate secure `ENCRYPTION_KEY` (32+ characters)
- [ ] Configure `ALLOWED_ORIGINS` with your production frontend URLs
- [ ] Set up persistent disk for database
- [ ] Integrate real email service (SendGrid, AWS SES, etc.)
- [ ] Configure monitoring and alerts
- [ ] Set up database backups
- [ ] Review rate limits and adjust if needed
- [ ] Test recovery flow end-to-end
- [ ] Document recovery procedures for users

## Email Service Integration

Current implementation logs codes to console. For production:

### Option 1: SendGrid

```bash
npm install @sendgrid/mail
```

Update `recovery-server/src/routes/verify.ts:31`:
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

await sgMail.send({
  to: email,
  from: 'noreply@yourdomain.com',
  subject: 'Recovery Verification Code',
  text: `Your verification code is: ${code}`,
  html: `<strong>Your verification code is: ${code}</strong>`
});
```

### Option 2: AWS SES

```bash
npm install @aws-sdk/client-ses
```

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-1' });
await ses.send(new SendEmailCommand({
  Source: 'noreply@yourdomain.com',
  Destination: { ToAddresses: [email] },
  Message: {
    Subject: { Data: 'Recovery Verification Code' },
    Body: { Text: { Data: `Your code is: ${code}` }}
  }
}));
```

## Architecture

```
┌─────────────────┐
│   Demo App      │
│  (Next.js)      │
└────────┬────────┘
         │ API calls
         ▼
┌─────────────────┐
│ Recovery Server │
│  (Express.js)   │
├─────────────────┤
│ • SEP-30 API    │
│ • Email verify  │
│ • GitHub OAuth  │
│ • Transaction   │
│   signing       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQLite DB      │
│ • Accounts      │
│ • Identities    │
│ • Signing keys  │
│   (encrypted)   │
└─────────────────┘
```

## Security Features

1. **Encryption**: AES-256-GCM with PBKDF2 key derivation
2. **Rate Limiting**: 100 req/15min general, 10 verify/hour
3. **CORS**: Configured origins only
4. **Helmet.js**: Security headers
5. **Input Validation**: All endpoints validate inputs
6. **Audit Log**: Recovery attempts tracked

## Monitoring

Monitor these endpoints:

- **Health**: `GET /health` - Server status
- **Metrics**: Check Render dashboard for:
  - CPU usage
  - Memory usage
  - Request rates
  - Error rates
  - Database size

## Troubleshooting

### Database Issues
```bash
# On Render, check disk mount
ls -la /opt/render/project/src/data

# Check database file
file /opt/render/project/src/data/recovery.db
```

### CORS Errors
- Verify `ALLOWED_ORIGINS` includes your frontend URL
- Check protocol matches (http vs https)

### Rate Limit Issues
- Review logs for IP addresses
- Adjust limits in `src/index.ts` if needed

## Support

For issues:
1. Check Render logs for errors
2. Verify environment variables are set correctly
3. Test health endpoint
4. Review demo app console for client-side errors
