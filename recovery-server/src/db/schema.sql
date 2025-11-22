-- SEP-30 Recovery Server Database Schema

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  stellar_address TEXT PRIMARY KEY,
  encrypted_signer_key TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_recovery_attempt DATETIME,
  recovery_count INTEGER DEFAULT 0
);

-- Recovery identities table
CREATE TABLE IF NOT EXISTS identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stellar_address TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  verified BOOLEAN DEFAULT 0,
  metadata TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stellar_address) REFERENCES accounts(stellar_address) ON DELETE CASCADE,
  UNIQUE(stellar_address, type, value)
);

-- Recovery attempts log
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stellar_address TEXT NOT NULL,
  identity_type TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  verified BOOLEAN DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stellar_address) REFERENCES accounts(stellar_address) ON DELETE CASCADE
);

-- Verification codes (temporary, for email verification)
CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_value TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_identities_address ON identities(stellar_address);
CREATE INDEX IF NOT EXISTS idx_identities_type_value ON identities(type, value);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_address ON recovery_attempts(stellar_address);
CREATE INDEX IF NOT EXISTS idx_verification_codes_value ON verification_codes(identity_value);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
