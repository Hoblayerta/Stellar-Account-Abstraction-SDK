import { NextRequest, NextResponse } from 'next/server';
import { getAccountInfo, updateAccountIdentities, type RecoveryIdentity } from '@/lib/recoveryServerClient';

/**
 * SEP-30: Get recovery methods for account from recovery server
 * GET /api/recovery/methods?address=GXXX...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Stellar address required' },
        { status: 400 }
      );
    }

    const accountInfo = await getAccountInfo(address);

    return NextResponse.json({
      success: true,
      address: accountInfo.address,
      identities: accountInfo.identities,
      count: accountInfo.identities.length
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Return empty array if account not found (not registered yet)
    if (message.includes('not found')) {
      return NextResponse.json({
        success: true,
        address: request.nextUrl.searchParams.get('address'),
        identities: [],
        count: 0
      });
    }

    console.error('❌ Failed to get recovery methods:', error);
    return NextResponse.json(
      {
        error: 'Failed to get recovery methods',
        details: message
      },
      { status: 500 }
    );
  }
}

/**
 * SEP-30: Update account identities on recovery server
 * POST /api/recovery/methods
 */
export async function POST(request: NextRequest) {
  try {
    const { stellarAddress, identities } = await request.json();

    if (!stellarAddress || !identities) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(identities)) {
      return NextResponse.json(
        { error: 'Identities must be an array' },
        { status: 400 }
      );
    }

    const result = await updateAccountIdentities(
      stellarAddress,
      identities as RecoveryIdentity[]
    );

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Recovery methods updated'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to update recovery methods:', error);
    return NextResponse.json(
      {
        error: 'Failed to update recovery methods',
        details: message
      },
      { status: 500 }
    );
  }
}
