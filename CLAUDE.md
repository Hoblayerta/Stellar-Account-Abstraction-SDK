# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stellar Social Wallet project that enables social login authentication on the Stellar blockchain. The project consists of three main components:

1. **Stellar Social SDK** (`stellar-social-sdk/`) - TypeScript SDK for social authentication with Stellar accounts
2. **Demo App** (`demo-app/`) - Next.js demo application showcasing the SDK
3. **Smart Contracts** (`contracts/social-account/`) - Soroban smart contracts for social wallet functionality

## Architecture

### Stellar Social SDK
- **Main SDK Class**: `StellarSocialSDK` in `stellar-social-sdk/src/index.ts`
- **Real OAuth Integration**: Google OAuth using Google Identity Services (requires GOOGLE_CLIENT_ID)
- **Auth Providers**: Google (real OAuth), Facebook (mock), Phone, and Freighter wallet support
- **Account Management**: `StellarSocialAccount` class handles account operations
- **Crypto Utils**: Deterministic keypair generation using Google sub ID for consistency

### Demo App
- Next.js 15 application with real Google OAuth integration
- Uses the local stellar-social-sdk package (`file:../stellar-social-sdk`)
- Google Identity Services script loaded for authentic OAuth flow
- Requires `.env.local` with `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### Smart Contracts
- Soroban smart contracts written in Rust
- Located in `contracts/social-account/contracts/social-wallet/`
- Handles on-chain social wallet operations

## Development Commands

### SDK Development
```bash
cd stellar-social-sdk
npm run build        # Build SDK with Rollup
npm run dev          # Watch mode for development
npm run test         # Run SDK tests
```

### Demo App Development
```bash
cd demo-app
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Smart Contract Development
```bash
cd contracts/social-account/contracts/social-wallet
make build           # Build Soroban contract
make test            # Run contract tests
make fmt             # Format Rust code
make clean           # Clean build artifacts
```

## Key Components

### Authentication Flow
1. **Google OAuth**: Real Google Identity Services integration using user's Google sub ID
2. **Deterministic Addresses**: Uses Google sub ID (not email) for consistent keypair generation
3. **Account Creation**: Auto-funds testnet accounts via Friendbot on first login
4. **JWT Processing**: Demo app manually parses Google JWT tokens for user info

### Google OAuth Setup
- Requires Google Cloud Console project with OAuth 2.0 client ID
- Demo app expects `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local`
- SDK `googleProvider` is conditionally initialized only if `googleClientId` is provided
- Uses `window.handleGoogleCredential` callback for OAuth response

### Network Configuration
- Supports both testnet and mainnet
- Default contract ID: `CALZGCSB3P3WEBLW3QTF5Y4WEALEVTYUYBC7KBGQ266GDINT7U4E74KW`
- Horizon server URLs automatically selected based on network

### Testing
- Use testnet for development and testing
- Phone verification uses mock code "123456"
- Facebook auth is mocked for MVP
- Google auth requires real OAuth setup

## Configuration Requirements

### Environment Variables (Demo App)
Create `.env.local` in `demo-app/`:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Google OAuth Setup
1. Create project in Google Cloud Console
2. Enable Google Identity Services
3. Create OAuth 2.0 client ID for web application
4. Add your domain to authorized origins
5. Copy client ID to environment variable

## Important Notes

- **Deterministic Keypairs**: Uses Google sub ID for consistent address generation
- **Real OAuth**: Demo now uses authentic Google Identity Services integration
- **Environment Required**: Demo app will show configuration error without Google Client ID
- **JWT Parsing**: Demo app manually decodes Google JWT tokens for user information
- **Freighter Support**: SDK supports connecting existing Stellar wallets
- **Smart Contracts**: Use Soroban SDK v22.0.0
- **Local SDK**: Demo app uses file-based dependency (`file:../stellar-social-sdk`)