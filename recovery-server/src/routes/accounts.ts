import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { encrypt, decrypt, generateSalt, generateSigningKeypair } from '../utils/crypto';
import { RegisterAccountRequest, RecoveryIdentity } from '../types';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const router = Router();

/**
 * SEP-30: POST /accounts/:address
 * Register an account with recovery identities
 */
router.post('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { identities } = req.body as RegisterAccountRequest;

    // Validate
    if (!address || !address.startsWith('G') || address.length !== 56) {
      return res.status(400).json({ error: 'Invalid Stellar address' });
    }

    if (!identities || !Array.isArray(identities) || identities.length === 0) {
      return res.status(400).json({ error: 'At least one identity required' });
    }

    // Check if account already registered
    const existing = db.prepare('SELECT stellar_address FROM accounts WHERE stellar_address = ?').get(address);
    if (existing) {
      return res.status(409).json({ error: 'Account already registered' });
    }

    // Generate signing keypair for this account
    const signingKeypair = generateSigningKeypair();
    const salt = generateSalt();

    // Encrypt the signing key
    const encryptedKey = encrypt(signingKeypair.secret(), salt);

    // Insert account
    db.prepare(`
      INSERT INTO accounts (stellar_address, encrypted_signer_key, encryption_salt)
      VALUES (?, ?, ?)
    `).run(address, encryptedKey, salt);

    // Insert identities
    const insertIdentity = db.prepare(`
      INSERT INTO identities (stellar_address, type, value, verified, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const identity of identities) {
      insertIdentity.run(
        address,
        identity.type,
        identity.value,
        identity.verified ? 1 : 0,
        identity.metadata ? JSON.stringify(identity.metadata) : null
      );
    }

    console.log(`✅ Account registered: ${address} with ${identities.length} identities`);

    res.json({
      address,
      identities: identities.map(i => ({
        role: 'owner',
        type: i.type,
        value: i.value
      })),
      signer: {
        key: signingKeypair.publicKey(),
        weight: 1
      }
    });

  } catch (error) {
    console.error('❌ Account registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * SEP-30: GET /accounts/:address
 * Get account recovery information
 */
router.get('/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const account = db.prepare('SELECT * FROM accounts WHERE stellar_address = ?').get(address);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const identities = db.prepare(`
      SELECT type, value, verified, metadata, added_at
      FROM identities
      WHERE stellar_address = ?
    `).all(address) as any[];

    res.json({
      address,
      identities: identities.map(i => ({
        role: 'owner',
        type: i.type,
        value: i.value,
        authenticated: i.verified === 1,
        metadata: i.metadata ? JSON.parse(i.metadata) : undefined
      })),
      signers: [{
        key: '(encrypted)',
        added: (account as any).created_at
      }]
    });

  } catch (error) {
    console.error('❌ Get account failed:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

/**
 * SEP-30: PUT /accounts/:address
 * Update account identities
 */
router.put('/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { identities } = req.body;

    const account = db.prepare('SELECT stellar_address FROM accounts WHERE stellar_address = ?').get(address);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Delete existing identities
    db.prepare('DELETE FROM identities WHERE stellar_address = ?').run(address);

    // Insert new identities
    const insertIdentity = db.prepare(`
      INSERT INTO identities (stellar_address, type, value, verified, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const identity of identities) {
      insertIdentity.run(
        address,
        identity.type,
        identity.value,
        identity.verified ? 1 : 0,
        identity.metadata ? JSON.stringify(identity.metadata) : null
      );
    }

    console.log(`✅ Account updated: ${address}`);
    res.json({ success: true, address });

  } catch (error) {
    console.error('❌ Update account failed:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * SEP-30: DELETE /accounts/:address
 * Delete account
 */
router.delete('/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = db.prepare('DELETE FROM accounts WHERE stellar_address = ?').run(address);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`✅ Account deleted: ${address}`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Delete account failed:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

/**
 * SEP-30: POST /accounts/:address/sign/:signing_address
 * Sign a transaction for recovery
 */
router.post('/:address/sign/:signing_address', async (req: Request, res: Response) => {
  try {
    const { address, signing_address } = req.params;
    const { transaction, verifiedIdentities } = req.body;

    // Get account
    const account = db.prepare('SELECT * FROM accounts WHERE stellar_address = ?').get(address) as any;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Verify that at least one identity is verified
    if (!verifiedIdentities || verifiedIdentities.length === 0) {
      return res.status(403).json({ error: 'No verified identities provided' });
    }

    // Check that provided identities match registered ones
    for (const verifiedId of verifiedIdentities) {
      const identity = db.prepare(`
        SELECT * FROM identities
        WHERE stellar_address = ? AND type = ? AND value = ?
      `).get(address, verifiedId.type, verifiedId.value);

      if (!identity) {
        return res.status(403).json({ error: 'Identity not registered' });
      }
    }

    // Decrypt signing key
    const signingSecret = decrypt(account.encrypted_signer_key, account.encryption_salt);
    const signingKeypair = Keypair.fromSecret(signingSecret);

    // Verify signing_address matches
    if (signingKeypair.publicKey() !== signing_address) {
      return res.status(400).json({ error: 'Signing address mismatch' });
    }

    // Parse and sign transaction
    const network = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const tx = TransactionBuilder.fromXDR(transaction, network);

    tx.sign(signingKeypair);

    // Log recovery attempt
    db.prepare(`
      INSERT INTO recovery_attempts (stellar_address, identity_type, identity_value, verified, ip_address)
      VALUES (?, ?, ?, 1, ?)
    `).run(
      address,
      verifiedIdentities[0].type,
      verifiedIdentities[0].value,
      req.ip
    );

    // Update last recovery attempt
    db.prepare('UPDATE accounts SET last_recovery_attempt = datetime("now"), recovery_count = recovery_count + 1 WHERE stellar_address = ?')
      .run(address);

    console.log(`✅ Transaction signed for recovery: ${address}`);

    res.json({
      signature: tx.toXDR(),
      signer: signingKeypair.publicKey()
    });

  } catch (error) {
    console.error('❌ Sign transaction failed:', error);
    res.status(500).json({ error: 'Sign failed' });
  }
});

export default router;
