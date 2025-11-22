# GitHub OAuth Setup for SEP-30 Recovery

This guide shows how to configure **real** GitHub OAuth for account recovery (no mocks, production-ready).

## Quick Setup (5 minutes)

### 1. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the form:
   ```
   Application name: Stellar Social Wallet (Local Dev)
   Homepage URL: http://localhost:3000
   Authorization callback URL: http://localhost:3000/recovery/github/callback
   ```
4. Click **"Register application"**
5. You'll see your **Client ID**
6. Click **"Generate a new client secret"**
7. **Copy both values immediately** (secret shown only once)

### 2. Configure Environment Variables

Create or update `.env.local` in `demo-app/`:

```bash
# Required for Google login
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Add these for GitHub recovery
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

**Example:**
```bash
NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678
```

### 3. Start the App

```bash
cd demo-app
npm run dev
```

### 4. Test OAuth Flow

1. Open http://localhost:3000
2. Login with Google
3. Click **"🛡️ Setup Recovery"** button
4. In recovery page, click **"Setup GitHub Recovery"**
5. You'll be redirected to GitHub
6. Click **"Authorize [your app name]"**
7. You'll be redirected back with success message
8. Your GitHub account is now registered as recovery method

## How It Works

### OAuth Flow

```
1. User clicks "Setup GitHub Recovery"
   ↓
2. Browser redirects to GitHub with:
   - client_id
   - redirect_uri
   - state (CSRF protection)
   ↓
3. User authorizes on GitHub
   ↓
4. GitHub redirects to /recovery/github/callback?code=XXX&state=YYY
   ↓
5. Callback page sends code to /api/github-oauth
   ↓
6. API route exchanges code for access_token (server-side with client_secret)
   ↓
7. API fetches user info from GitHub API
   ↓
8. Returns user data to client (WITHOUT exposing access_token)
   ↓
9. Recovery page displays success
```

### Security Features

✅ **Server-side token exchange**
- `client_secret` never sent to browser
- Token exchange happens in Next.js API route
- Access token never exposed to client

✅ **CSRF Protection**
- Random `state` parameter generated
- Verified on callback
- Prevents CSRF attacks

✅ **Secure session storage**
- User data temporarily in sessionStorage
- Cleared after processing
- No sensitive data persisted

## API Routes

### POST `/api/github-oauth`

Exchanges authorization code for user info (server-side).

**Request:**
```json
{
  "code": "authorization_code_from_github",
  "redirectUri": "http://localhost:3000/recovery/github/callback"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 12345,
    "login": "username",
    "email": "user@example.com",
    "name": "User Name",
    "avatar_url": "https://avatars.githubusercontent.com/..."
  }
}
```

## Production Deployment

### 1. Update OAuth App Settings

In GitHub OAuth App settings, update:
```
Homepage URL: https://yourdomain.com
Authorization callback URL: https://yourdomain.com/recovery/github/callback
```

### 2. Environment Variables

Set in your production environment (Vercel, Railway, etc.):
```bash
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

**Never commit `.env.local` to git!**

### 3. HTTPS Required

GitHub OAuth requires HTTPS in production. Local development works with HTTP.

## Troubleshooting

### "GitHub OAuth not configured"

**Problem:** Missing environment variables

**Solution:**
```bash
# Check .env.local exists and has both variables:
cat demo-app/.env.local | grep GITHUB

# Should show:
NEXT_PUBLIC_GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### "Invalid state parameter"

**Problem:** CSRF protection triggered

**Solution:** This is a security feature. Try the OAuth flow again from the beginning.

### "GitHub token exchange failed"

**Possible causes:**
1. Invalid `client_secret` in `.env.local`
2. Callback URL mismatch in GitHub app settings
3. Authorization code already used (codes are single-use)

**Solution:**
- Verify `client_secret` matches GitHub app
- Check callback URL is exactly: `http://localhost:3000/recovery/github/callback`
- Try OAuth flow again (generates new code)

### "Application suspended"

**Problem:** GitHub app suspended or deleted

**Solution:** Create a new OAuth app in GitHub settings

## Testing Checklist

- [ ] GitHub OAuth app created
- [ ] Environment variables configured
- [ ] App runs without errors (`npm run dev`)
- [ ] "Setup GitHub Recovery" button visible
- [ ] Clicking button redirects to GitHub
- [ ] Authorization on GitHub works
- [ ] Redirected back to `/recovery/github/callback`
- [ ] Callback page shows "Authenticating..."
- [ ] Success message appears
- [ ] Recovery page shows GitHub user info
- [ ] User avatar displays correctly

## SEP-30 Integration

After GitHub authentication succeeds:

1. **User Data Stored:**
   ```javascript
   {
     id: 12345,           // Used for deterministic recovery key
     login: "username",   // Display name
     email: "user@...",   // Recovery email
     avatar_url: "..."    // Profile picture
   }
   ```

2. **Recovery Identity Created:**
   ```javascript
   {
     type: 'email',
     value: user.email || `${user.login}@users.noreply.github.com`
   }
   ```

3. **In Production:**
   - This identity sent to SEP-30 recovery server
   - Recovery server generates encrypted signing key
   - Key associated with GitHub user ID
   - During recovery, user authenticates with GitHub
   - Recovery server verifies GitHub identity
   - Signs transaction to restore account access

## Next Steps

After GitHub OAuth works:

1. **Email Recovery:** Already implemented with demo codes
2. **Recovery Server:** Implement SEP-30 compliant server
3. **Multi-Sig:** Configure account with recovery signers
4. **Testing:** Test full recovery flow end-to-end

## Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [SEP-30 Specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0030.md)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Verify GitHub OAuth app configuration
3. Check browser console for errors
4. Check Next.js server logs
5. Open issue on GitHub repository
