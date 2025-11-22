# SEP-30 Recovery - Production Roadmap

**Current Status**: ✅ Testnet Demo | ❌ Production Ready
**Compliance Score**: 45/100 (SEP-30)
**Security Score**: 52/100

---

## What Works Now (Testnet Demo)

### ✅ Implemented Features

1. **Recovery Server Infrastructure**
   - Express.js API with TypeScript
   - SQLite database with schema
   - AES-256-GCM encryption for signing keys
   - PBKDF2 key derivation (100,000 iterations)
   - Rate limiting (100 req/15min, 10 verify/hour)
   - Helmet.js security headers
   - CORS configuration

2. **Identity Verification**
   - Email verification with 6-digit codes
   - GitHub OAuth integration
   - Server-side token exchange
   - CSRF protection with state parameter
   - Verification code expiry (15 minutes)

3. **Account Registration**
   - Register Stellar address with recovery identities
   - Generate encrypted signing keypair per account
   - Store multiple recovery methods (email, GitHub)
   - Return recovery signer public key

4. **Database Layer**
   - Accounts with encrypted keys
   - Recovery identities per account
   - Verification codes with auto-cleanup
   - Recovery attempts audit log
   - Foreign key constraints
   - Proper indexes

5. **Demo App Integration**
   - Recovery setup UI (/recovery)
   - Recovery flow UI (/recover)
   - Email verification flow
   - GitHub OAuth flow
   - Account lookup by address
   - Real API integration (no mocks)

---

## What's Missing for Production

### 🔴 CRITICAL - Must Implement

#### 1. SEP-10 Authentication (Priority: CRITICAL)

**Current Problem**:
```typescript
// recovery-server/src/routes/accounts.ts:13
router.post('/:address', async (req: Request, res: Response) => {
  const { address } = req.params;
  // ❌ NO VERIFICATION that requester owns this address
  // Anyone can register any Stellar address!
```

**What SEP-30 Requires**:
> "The registration defined in SEP-30 requires SEP-10."

**Implementation Steps**:

1. **Install SEP-10 Dependencies**
```bash
cd recovery-server
npm install @stellar/stellar-sdk stellar-sdk
```

2. **Create SEP-10 Challenge Endpoint**
```typescript
// recovery-server/src/routes/sep10.ts
import { Keypair, Networks, TransactionBuilder, Operation } from '@stellar/stellar-sdk';

const SERVER_KEYPAIR = Keypair.fromSecret(process.env.SEP10_SERVER_SECRET!);

router.get('/sep10/challenge', (req, res) => {
  const { account } = req.query;

  // Build challenge transaction
  const txBuilder = new TransactionBuilder(
    new Account(account, '-1'),
    {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
      timebounds: { minTime: 0, maxTime: Date.now() / 1000 + 300 }
    }
  );

  txBuilder.addOperation(
    Operation.manageData({
      name: 'stellar.sep10.challenge',
      value: crypto.randomBytes(64).toString('base64')
    })
  );

  const tx = txBuilder.build();
  tx.sign(SERVER_KEYPAIR);

  res.json({
    transaction: tx.toXDR(),
    network_passphrase: Networks.TESTNET
  });
});
```

3. **Create SEP-10 Verification Middleware**
```typescript
// recovery-server/src/middleware/sep10Auth.ts
import { Transaction, Networks } from '@stellar/stellar-sdk';

export async function requireSEP10Auth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'SEP-10 authentication required' });
  }

  try {
    const token = authHeader.substring(7);
    const tx = new Transaction(token, Networks.TESTNET);

    // Validate transaction:
    // 1. Signed by SERVER_KEYPAIR
    // 2. Signed by client account
    // 3. Not expired
    // 4. Has manage_data operation with our challenge

    const clientAccount = extractClientAccount(tx);

    req.authenticatedAccount = clientAccount;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid SEP-10 token' });
  }
}
```

4. **Apply to Protected Routes**
```typescript
// recovery-server/src/routes/accounts.ts
import { requireSEP10Auth } from '../middleware/sep10Auth';

router.post('/:address', requireSEP10Auth, async (req, res) => {
  const { address } = req.params;

  // Verify authenticated account matches address
  if (req.authenticatedAccount !== address) {
    return res.status(403).json({
      error: 'Can only register your own account'
    });
  }

  // ... rest of handler
});
```

5. **Update Demo App**
```typescript
// demo-app/src/lib/sep10Client.ts
export async function authenticateWithSEP10(
  accountKeypair: Keypair
): Promise<string> {
  // 1. Get challenge
  const challenge = await fetch(
    `${RECOVERY_SERVER_URL}/sep10/challenge?account=${accountKeypair.publicKey()}`
  );
  const { transaction } = await challenge.json();

  // 2. Sign challenge
  const tx = new Transaction(transaction, Networks.TESTNET);
  tx.sign(accountKeypair);

  // 3. Return token
  return tx.toXDR();
}
```

**Effort**: 2-3 days
**Impact**: Prevents account hijacking
**SEP-10 Spec**: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md

---

#### 2. Transaction Validation Before Signing (Priority: CRITICAL)

**Current Problem**:
```typescript
// recovery-server/src/routes/accounts.ts:229
const tx = TransactionBuilder.fromXDR(transaction, network);
tx.sign(signingKeypair); // ❌ Signs ANY transaction blindly!
```

**Security Risk**: Attacker could submit malicious transaction (e.g., payment to their address) and recovery server would sign it.

**Implementation Steps**:

1. **Create Transaction Validator**
```typescript
// recovery-server/src/utils/transactionValidator.ts
import { Transaction, Operation } from '@stellar/stellar-sdk';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRecoveryTransaction(
  tx: Transaction,
  stellarAddress: string,
  expectedSignerKey: string
): ValidationResult {
  // 1. Check source account
  if (tx.source !== stellarAddress) {
    return { valid: false, error: 'Transaction source must be the account being recovered' };
  }

  // 2. Must have exactly one Set Options operation
  const setOptionsOps = tx.operations.filter(op => op.type === 'setOptions');
  if (setOptionsOps.length !== 1) {
    return { valid: false, error: 'Must have exactly one Set Options operation' };
  }

  const setOp = setOptionsOps[0] as Operation.SetOptions;

  // 3. Must be adding/updating a signer
  if (!setOp.signer) {
    return { valid: false, error: 'Set Options must include signer' };
  }

  // 4. Signer must be the new device key (not arbitrary key)
  // Note: We don't verify it's the expected key because user provides new key
  // But we verify the weight is reasonable
  if (!setOp.signer.weight || setOp.signer.weight < 1 || setOp.signer.weight > 255) {
    return { valid: false, error: 'Signer weight must be between 1 and 255' };
  }

  // 5. Master weight must not be removed
  if (setOp.masterWeight !== undefined && setOp.masterWeight === 0) {
    return { valid: false, error: 'Removing master key is not allowed' };
  }

  // 6. Thresholds must be set if provided
  if (setOp.lowThreshold !== undefined && setOp.lowThreshold < 0) {
    return { valid: false, error: 'Invalid threshold value' };
  }

  // 7. No other operations allowed
  if (tx.operations.length > 1) {
    return { valid: false, error: 'Only Set Options operation allowed in recovery transaction' };
  }

  return { valid: true };
}
```

2. **Apply Validation**
```typescript
// recovery-server/src/routes/accounts.ts
router.post('/:address/sign/:signing_address', async (req, res) => {
  const { address, signing_address } = req.params;
  const { transaction, verifiedIdentities } = req.body;

  // Parse transaction
  const network = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  const tx = TransactionBuilder.fromXDR(transaction, network);

  // ✅ VALIDATE before signing
  const validation = validateRecoveryTransaction(tx, address, signing_address);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid recovery transaction',
      details: validation.error
    });
  }

  // Decrypt and sign only if valid
  const signingSecret = decrypt(account.encrypted_signer_key, account.encryption_salt);
  const signingKeypair = Keypair.fromSecret(signingSecret);
  tx.sign(signingKeypair);

  // ... rest
});
```

**Effort**: 1-2 days
**Impact**: Prevents malicious transaction signing

---

#### 3. Complete Recovery Flow (Priority: CRITICAL)

**Current Problem**:
```typescript
// demo-app/src/app/recover/page.tsx:329
<p>Next Steps:</p>
<ol>
  <li>In production, you would create a new device keypair</li>
  <li>The server would sign a transaction to add your new key</li>
  // ❌ Just explains what SHOULD happen, doesn't DO it
</ol>
```

**Implementation Steps**:

1. **Create Recovery Execution Function**
```typescript
// demo-app/src/lib/recoveryExecution.ts
import {
  Keypair,
  Server,
  TransactionBuilder,
  Networks,
  Operation,
  Account
} from '@stellar/stellar-sdk';
import { signRecoveryTransaction } from './recoveryServerClient';

export async function executeAccountRecovery(
  oldAddress: string,
  verifiedIdentity: RecoveryIdentity,
  recoverySignerPublicKey: string
): Promise<{
  newKeypair: Keypair;
  transactionHash: string;
}> {
  // 1. Generate NEW device keypair
  const newKeypair = Keypair.random();
  console.log('✅ Generated new device keypair:', newKeypair.publicKey());

  // 2. Load account from Stellar network
  const server = new Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(oldAddress);

  // 3. Build transaction to add new signer
  const transaction = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.setOptions({
      signer: {
        ed25519PublicKey: newKeypair.publicKey(),
        weight: 2  // New device key weight
      }
    }))
    .setTimeout(300)
    .build();

  // 4. Request recovery server signature
  console.log('📝 Requesting recovery server signature...');
  const serverSigned = await signRecoveryTransaction(
    oldAddress,
    recoverySignerPublicKey,
    transaction.toXDR(),
    [verifiedIdentity]
  );

  // 5. Parse server-signed transaction
  const signedTx = TransactionBuilder.fromXDR(
    serverSigned.signature,
    Networks.TESTNET
  );

  // 6. Add new keypair signature
  signedTx.sign(newKeypair);
  console.log('✅ Transaction fully signed');

  // 7. Submit to Stellar network
  console.log('🚀 Submitting to Stellar network...');
  const result = await server.submitTransaction(signedTx);

  console.log('✅ Account recovered! Hash:', result.hash);

  return {
    newKeypair,
    transactionHash: result.hash
  };
}
```

2. **Update Recovery UI**
```typescript
// demo-app/src/app/recover/page.tsx
const handleCompleteRecovery = async () => {
  if (!verifiedIdentity || !stellarAddress || !recoverySignerKey) {
    toast.error('Missing recovery information');
    return;
  }

  try {
    setIsRecovering(true);
    toast.loading('Executing recovery on Stellar network...', { id: 'recover' });

    const result = await executeAccountRecovery(
      stellarAddress,
      verifiedIdentity,
      recoverySignerKey
    );

    // Store new keypair
    localStorage.setItem('stellar_account', JSON.stringify({
      publicKey: result.newKeypair.publicKey(),
      secretKey: result.newKeypair.secret()
    }));

    toast.success('Account recovered successfully!', { id: 'recover' });
    setTransactionHash(result.transactionHash);
    setNewKeypair(result.newKeypair);
    setStep('recovery-complete');

  } catch (error) {
    console.error('Recovery failed:', error);
    toast.error(error.message, { id: 'recover' });
  } finally {
    setIsRecovering(false);
  }
};
```

**Effort**: 3-4 days
**Impact**: Makes recovery actually functional

---

### 🟡 IMPORTANT - Should Implement

#### 4. Stronger Verification Codes

**Current**:
```typescript
// 6-digit numeric only
return Math.floor(100000 + Math.random() * 900000).toString();
```

**Improve To**:
```typescript
// recovery-server/src/utils/crypto.ts
export function generateVerificationCode(): string {
  // 8 alphanumeric characters
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous: 0,O,1,I
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
// Example: "K7N4P2M9" instead of "123456"
```

**Add**:
- CAPTCHA for code requests
- Rate limit per email address (not just IP)
- Email verification link as alternative

**Effort**: 1 day
**Impact**: Prevents brute force

---

#### 5. HTTPS Enforcement

**Add**:
```typescript
// recovery-server/src/index.ts
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

**Render Config**:
```yaml
# render.yaml
services:
  - type: web
    env: production
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: FORCE_HTTPS
        value: true
```

**Effort**: 1 hour
**Impact**: Prevents code interception

---

#### 6. Key Management System (KMS)

**Current**: Encryption key in environment variable
**Production**: Use AWS KMS, Google Cloud KMS, or Azure Key Vault

**Example with AWS KMS**:
```typescript
// recovery-server/src/utils/kms.ts
import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: process.env.AWS_REGION });
const KMS_KEY_ID = process.env.KMS_KEY_ID;

export async function encryptSigningKey(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext)
  });
  const result = await kms.send(command);
  return Buffer.from(result.CiphertextBlob).toString('base64');
}

export async function decryptSigningKey(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64')
  });
  const result = await kms.send(command);
  return Buffer.from(result.Plaintext).toString('utf8');
}
```

**Benefits**:
- Key rotation support
- Audit logging of key usage
- Hardware security module (HSM) backing
- Compliance (SOC 2, HIPAA, etc.)

**Effort**: 2-3 days
**Impact**: Enterprise-grade security

---

#### 7. Database Encryption at Rest

**Current**: SQLite file unencrypted on disk

**Options**:

**A. SQLCipher** (Encrypted SQLite)
```bash
npm install better-sqlite3-sqlcipher
```

```typescript
// recovery-server/src/db/database.ts
import Database from 'better-sqlite3-sqlcipher';

const db = new Database(DB_PATH);
db.pragma(`key='${process.env.DB_ENCRYPTION_KEY}'`);
```

**B. Migrate to PostgreSQL with encryption**
```yaml
# render.yaml
databases:
  - name: recovery-db
    plan: starter
    region: oregon
    databaseName: recovery
    user: recovery_user
    encryption: true  # Render provides encryption at rest
```

**Effort**: 1-2 days (SQLCipher) or 3-4 days (PostgreSQL)
**Impact**: Protects data if filesystem compromised

---

#### 8. Monitoring and Alerting

**Implement**:

1. **Prometheus Metrics**
```typescript
// recovery-server/src/metrics.ts
import promClient from 'prom-client';

export const metrics = {
  registrations: new promClient.Counter({
    name: 'recovery_registrations_total',
    help: 'Total account registrations'
  }),
  verifications: new promClient.Counter({
    name: 'recovery_verifications_total',
    help: 'Total identity verifications',
    labelNames: ['type', 'status']
  }),
  recoveryAttempts: new promClient.Counter({
    name: 'recovery_attempts_total',
    help: 'Total recovery attempts',
    labelNames: ['status']
  })
};

// Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

2. **Error Tracking** (Sentry)
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.errorHandler());
```

3. **Log Aggregation** (Datadog, LogDNA)
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

**Effort**: 2-3 days
**Impact**: Operational visibility

---

### 🟢 NICE TO HAVE - Future Enhancements

#### 9. Multi-Server Recovery (True Decentralization)

**Current**: Single recovery server
**SEP-30 Recommendation**: Multiple independent servers

**Architecture**:
```
User Account
├── Device Key (weight: 2)
├── Recovery Server 1 (weight: 1)
├── Recovery Server 2 (weight: 1)
└── Recovery Server 3 (weight: 1)

Thresholds: low=2, medium=2, high=2

Recovery: Need ANY 2 servers OR device key
```

**Implementation**:
- Deploy 3 independent recovery servers
- Different hosting providers (AWS, GCP, Azure)
- Different geographic regions
- Client coordinates signature collection
- Threshold signing (2-of-3)

**Effort**: 1-2 weeks
**Impact**: No single point of failure

---

#### 10. Backup and Disaster Recovery

**Implement**:

1. **Automated Database Backups**
```bash
# Cron job (daily at 2 AM)
0 2 * * * pg_dump recovery_db | gzip > /backups/recovery_$(date +\%Y\%m\%d).sql.gz
```

2. **Backup Encryption**
```bash
gpg --encrypt --recipient admin@company.com backup.sql.gz
```

3. **Offsite Storage**
```bash
aws s3 cp backup.sql.gz.gpg s3://recovery-backups/
```

4. **Recovery Testing**
- Monthly: Test restore from backup
- Quarterly: Full disaster recovery drill

**Effort**: 2-3 days
**Impact**: Business continuity

---

#### 11. Compliance and Auditing

**Implement**:

1. **Audit Logs**
```typescript
// Detailed logging of all sensitive operations
interface AuditLog {
  timestamp: Date;
  action: 'register' | 'verify' | 'recover' | 'sign';
  stellarAddress: string;
  identityType: string;
  identityValue: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  metadata?: any;
}
```

2. **Compliance Reports**
- SOC 2 Type II audit trail
- GDPR data access logs
- User data export capability

3. **Data Retention Policies**
```typescript
// Auto-delete verification codes after 24 hours
// Archive recovery attempts after 90 days
// Anonymize old audit logs after 2 years
```

**Effort**: 1 week
**Impact**: Regulatory compliance

---

#### 12. Advanced Security Features

**Implement**:

1. **Account Lock After Failed Recoveries**
```typescript
if (account.failed_recovery_attempts >= 5) {
  // Lock account for 24 hours
  // Notify account owner via all identities
  // Require manual unlock
}
```

2. **Anomaly Detection**
```typescript
// Flag suspicious patterns:
// - Recovery from new country/IP
// - Multiple failed attempts
// - Rapid identity changes
// - Recovery outside business hours
```

3. **Multi-Factor Recovery**
```typescript
// Require 2 different identity types for high-value accounts
if (accountValue > THRESHOLD) {
  requireIdentityTypes(['email', 'github']); // Not just one
}
```

**Effort**: 1-2 weeks
**Impact**: Advanced threat protection

---

## Implementation Timeline

### Phase 1: Critical Security (2-3 weeks)
- [ ] SEP-10 Authentication (Week 1)
- [ ] Transaction Validation (Week 1)
- [ ] Complete Recovery Flow (Week 2)
- [ ] Stronger Verification (Week 2)
- [ ] HTTPS Enforcement (Week 2)
- [ ] Testing and Bug Fixes (Week 3)

### Phase 2: Production Hardening (2-3 weeks)
- [ ] KMS Integration (Week 1)
- [ ] Database Encryption (Week 1)
- [ ] Monitoring & Alerting (Week 2)
- [ ] Backup System (Week 2)
- [ ] Security Audit (Week 3)
- [ ] Load Testing (Week 3)

### Phase 3: Advanced Features (4-6 weeks)
- [ ] Multi-Server Deployment (Weeks 1-2)
- [ ] Compliance Implementation (Weeks 3-4)
- [ ] Advanced Security (Weeks 5-6)

**Total Estimated Effort**: 8-12 weeks full-time

---

## Testing Checklist

### Before Mainnet Launch

- [ ] SEP-10 authentication working and tested
- [ ] Transaction validation catches malicious txs
- [ ] Complete recovery flow tested end-to-end
- [ ] Penetration testing completed
- [ ] Load testing (1000+ concurrent users)
- [ ] Database backups tested and verified
- [ ] Disaster recovery plan tested
- [ ] Key rotation tested
- [ ] Multi-server coordination tested
- [ ] Monitoring alerts tested
- [ ] Documentation complete
- [ ] Compliance audit passed
- [ ] Bug bounty program launched

---

## Security Considerations

### Current Vulnerabilities (Testnet Demo)

1. ❌ No account ownership verification (SEP-10)
2. ❌ No transaction validation before signing
3. ⚠️ Weak verification codes (6 digits only)
4. ⚠️ Single recovery server (SPOF)
5. ⚠️ Environment variable key storage
6. ⚠️ No HTTPS enforcement
7. ⚠️ No database encryption at rest

### Post-Production Hardening

1. ✅ SEP-10 authentication required
2. ✅ Transaction validation enforced
3. ✅ 8-character alphanumeric codes + CAPTCHA
4. ✅ Multiple independent recovery servers
5. ✅ KMS/HSM key management
6. ✅ HTTPS only in production
7. ✅ Encrypted database

---

## Cost Estimate (Production)

### Infrastructure (Monthly)

- **Render Web Service** (Starter): $7/month
- **PostgreSQL Database** (Starter): $7/month
- **AWS KMS**: $1/month (1 key) + $0.03/10k requests
- **S3 Backup Storage**: ~$1/month (100GB)
- **Monitoring (Datadog)**: $15/month (startup plan)
- **Error Tracking (Sentry)**: $26/month (team plan)
- **Total**: ~$60-70/month

### Additional Servers (Decentralization)

- **Recovery Server 2** (GCP): ~$10/month
- **Recovery Server 3** (Azure): ~$10/month
- **Total Multi-Server**: ~$90/month

### Development Cost

- **Phase 1** (Critical): $15,000 - $20,000 (2-3 weeks @ $100/hr)
- **Phase 2** (Hardening): $15,000 - $20,000 (2-3 weeks @ $100/hr)
- **Phase 3** (Advanced): $30,000 - $40,000 (4-6 weeks @ $100/hr)
- **Total Development**: $60,000 - $80,000

### Ongoing Costs

- **Security Audits**: $10,000 - $25,000/year
- **Compliance**: $5,000 - $15,000/year
- **Maintenance**: $2,000 - $5,000/month
- **Total Yearly**: $50,000 - $85,000

---

## Conclusion

**Testnet Demo Status**: ✅ Functional for learning and testing
**Production Readiness**: ❌ Requires 8-12 weeks of development

**Key Message**: Current implementation demonstrates SEP-30 concepts well but lacks critical security features for production use. The roadmap above provides a clear path to production readiness.

**Recommended Next Steps**:

1. Fix SEP-10 authentication (2-3 days)
2. Complete recovery flow (3-4 days)
3. Test on testnet with real Stellar accounts
4. Decide: Continue with SEP-30 or use simpler recovery (encrypted backups)
5. If continuing, follow Phase 1 → Phase 2 → Phase 3 roadmap

**Questions to Consider**:

- Do you need decentralized recovery or would encrypted Google Drive backups suffice?
- What's your target launch date for production?
- What's your budget for security audits and compliance?
- Do you plan to store high-value assets or is this primarily for demos?

---

**Last Updated**: 2024-11-22
**Version**: 1.0
**Status**: Draft - Subject to change based on security audit findings
