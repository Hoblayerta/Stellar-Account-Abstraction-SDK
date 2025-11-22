import { NextRequest, NextResponse } from 'next/server';
import { registerAccount, type RecoveryIdentity } from '@/lib/recoveryServerClient';

/**
 * SEP-30: Register account with recovery methods on recovery server
 * POST /api/recovery/register
 */
export async function POST(request: NextRequest) {
  try {
    const { stellarAddress, identities } = await request.json();

    // Validate inputs
    if (!stellarAddress || !identities) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(identities) || identities.length === 0) {
      return NextResponse.json(
        { error: 'At least one identity required' },
        { status: 400 }
      );
    }

    // Validate stellar address format
    if (!stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return NextResponse.json(
        { error: 'Invalid Stellar address' },
        { status: 400 }
      );
    }

    // Register account on recovery server
    const result = await registerAccount(stellarAddress, identities as RecoveryIdentity[]);

    console.log(`✅ Account registered on recovery server: ${stellarAddress}`);

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Account registered with recovery server'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Recovery registration failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to register account',
        details: message
      },
      { status: 500 }
    );
  }
}
