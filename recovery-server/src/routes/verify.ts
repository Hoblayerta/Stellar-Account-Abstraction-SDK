import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { generateVerificationCode } from '../utils/crypto';

const router = Router();

/**
 * Send verification code to email
 * POST /verify/email/send
 */
router.post('/email/send', (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Generate code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store code
    db.prepare(`
      INSERT INTO verification_codes (identity_value, code, expires_at)
      VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());

    // TODO: Send actual email in production
    // For demo, just log it
    console.log(`📧 Verification code for ${email}: ${code}`);

    res.json({
      success: true,
      message: 'Verification code sent',
      // For demo only - remove in production
      code: process.env.NODE_ENV === 'development' ? code : undefined
    });

  } catch (error) {
    console.error('❌ Send verification failed:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * Verify email code
 * POST /verify/email/check
 */
router.post('/email/check', (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    // Find valid code
    const record = db.prepare(`
      SELECT * FROM verification_codes
      WHERE identity_value = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(email, code) as any;

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Mark as used
    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

    console.log(`✅ Email verified: ${email}`);

    res.json({
      success: true,
      verified: true,
      identity: {
        type: 'email',
        value: email
      }
    });

  } catch (error) {
    console.error('❌ Verify email failed:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Verify GitHub OAuth token
 * POST /verify/github
 */
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Verify token with GitHub API
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return res.status(400).json({ error: 'Invalid GitHub token' });
    }

    const user = await response.json();

    console.log(`✅ GitHub verified: ${user.login}`);

    res.json({
      success: true,
      verified: true,
      identity: {
        type: 'github',
        value: user.email || `${user.login}@users.noreply.github.com`,
        metadata: {
          login: user.login,
          id: user.id,
          avatar_url: user.avatar_url
        }
      }
    });

  } catch (error) {
    console.error('❌ Verify GitHub failed:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
