import { EmailRecoveryRequest, EmailRecoveryVerification, RecoveryAuthMethod } from '../types/recovery.js';
export declare class EmailRecoveryProvider {
    private apiEndpoint;
    private pendingVerifications;
    constructor(apiEndpoint?: string);
    /**
     * Send recovery code to email
     */
    sendRecoveryCode(request: EmailRecoveryRequest): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Verify recovery code
     */
    verifyRecoveryCode(verification: EmailRecoveryVerification): Promise<boolean>;
    /**
     * Create SEP-30 auth method from verified email
     */
    createAuthMethod(email: string): RecoveryAuthMethod;
    /**
     * Generate 6-digit recovery code
     */
    private generateCode;
    /**
     * Get pending code for demo/testing
     */
    getPendingCode(email: string): string | undefined;
}
