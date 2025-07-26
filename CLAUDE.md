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
- **Auth Providers**: Google, Facebook (mock), Phone, and Freighter wallet support
- **Account Management**: `StellarSocialAccount` class handles account operations
- **Crypto Utils**: Deterministic keypair generation for social auth methods

### Demo App
- Next.js 15 application with TypeScript
- Uses the local stellar-social-sdk package
- Demonstrates social authentication flows

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
1. Users authenticate via social providers (Google, Facebook, Phone) or Freighter wallet
2. SDK generates deterministic Stellar keypairs for social auth methods
3. Smart contract manages auth methods and account recovery
4. Accounts are funded on testnet via Friendbot

### Network Configuration
- Supports both testnet and mainnet
- Default contract ID configured in `stellar-social-sdk/src/config.ts`
- Horizon server URLs automatically selected based on network

### Testing
- Use testnet for development and testing
- Phone verification uses mock code "123456"
- Facebook auth is mocked for MVP

## Important Notes

- The SDK uses deterministic keypair generation for social auth methods
- Freighter integration allows connecting existing Stellar wallets
- Smart contracts use Soroban SDK v22.0.0
- Demo app uses file-based dependency for the SDK (`file:../stellar-social-sdk`)