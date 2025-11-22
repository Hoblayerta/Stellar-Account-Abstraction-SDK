import { NextRequest, NextResponse } from 'next/server';
import { signRecoveryTransaction } from '@/lib/recoveryServerClient';

/**
 * SEP-30: Sign recovery transaction via recovery server
 * POST /api/recovery/verify
 */
export async function POST(request: NextRequest) {
  try {
    const {
      stellarAddress,
      signingAddress,
      transaction,
      verifiedIdentities
    } = await request.json();

    if (!stellarAddress || !signingAddress || !transaction || !verifiedIdentities) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(verifiedIdentities) || verifiedIdentities.length === 0) {
      return NextResponse.json(
        { error: 'At least one verified identity required' },
        { status: 400 }
      );
    }

    console.log('🔄 Requesting recovery transaction signature...');

    // Request recovery server to sign the transaction
    const result = await signRecoveryTransaction(
      stellarAddress,
      signingAddress,
      transaction,
      verifiedIdentities
    );

    console.log(`✅ Recovery transaction signed for: ${stellarAddress}`);

    return NextResponse.json({
      success: true,
      signature: result.signature,
      signer: result.signer,
      message: 'Recovery transaction signed successfully'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Recovery signature failed:', error);
    return NextResponse.json(
      {
        error: 'Recovery signature failed',
        details: message
      },
      { status: 500 }
    );
  }
}
