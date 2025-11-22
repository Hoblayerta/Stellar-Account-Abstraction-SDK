import { EmailRecoveryRequest, EmailRecoveryVerification, RecoveryAuthMethod } from '../types/recovery.js';

export class EmailRecoveryProvider {
  private apiEndpoint: string;
  private pendingVerifications: Map<string, string> = new Map();

  constructor(apiEndpoint: string = '/api/recovery/email') {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Send recovery code to email
   */
  async sendRecoveryCode(request: EmailRecoveryRequest): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📧 Sending recovery code to:', request.email);

      // For MVP/demo: generate and store code locally
      const code = this.generateCode();
      this.pendingVerifications.set(request.email, code);

      console.log(`🔑 Demo recovery code for ${request.email}: ${code}`);
      console.log('📧 In production, this would send an email');

      // In production, call API to send actual email
      // await fetch(this.apiEndpoint + '/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email: request.email })
      // });

      return { success: true };
    } catch (error: any) {
      console.error('❌ Failed to send recovery code:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify recovery code
   */
  async verifyRecoveryCode(verification: EmailRecoveryVerification): Promise<boolean> {
    try {
      console.log('🔍 Verifying recovery code for:', verification.email);

      // For MVP: check against stored code
      const storedCode = this.pendingVerifications.get(verification.email);
      if (!storedCode) {
        console.error('❌ No pending verification for this email');
        return false;
      }

      if (storedCode !== verification.code) {
        console.error('❌ Invalid recovery code');
        return false;
      }

      // Clear after successful verification
      this.pendingVerifications.delete(verification.email);
      console.log('✅ Recovery code verified');
      return true;
    } catch (error: any) {
      console.error('❌ Verification failed:', error.message);
      return false;
    }
  }

  /**
   * Create SEP-30 auth method from verified email
   */
  createAuthMethod(email: string): RecoveryAuthMethod {
    return {
      type: 'email',
      value: email
    };
  }

  /**
   * Generate 6-digit recovery code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get pending code for demo/testing
   */
  getPendingCode(email: string): string | undefined {
    return this.pendingVerifications.get(email);
  }
}
