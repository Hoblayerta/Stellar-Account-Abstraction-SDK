import { NextRequest, NextResponse } from 'next/server';
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Transaction,
  FeeBumpTransaction,
  Horizon,
} from '@stellar/stellar-sdk';

const SPONSOR_SECRET_KEY = process.env.SPONSOR_SECRET_KEY;
const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

export async function POST(request: NextRequest) {
  try {
    // Validar que existe la llave del sponsor
    if (!SPONSOR_SECRET_KEY || SPONSOR_SECRET_KEY === 'your_sponsor_secret_key_here') {
      return NextResponse.json(
        {
          error: 'Sponsor secret key no configurada. Por favor configura SPONSOR_SECRET_KEY en .env.local'
        },
        { status: 500 }
      );
    }

    const { transactionXDR } = await request.json();

    if (!transactionXDR) {
      return NextResponse.json(
        { error: 'transactionXDR es requerido' },
        { status: 400 }
      );
    }

    // Cargar la transacción original del usuario
    const networkPassphrase = NETWORK === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
    const transaction = new Transaction(transactionXDR, networkPassphrase);

    // Crear keypair del sponsor
    const sponsorKeypair = Keypair.fromSecret(SPONSOR_SECRET_KEY);

    // Conectar a Horizon para obtener info del sponsor
    const server = new Horizon.Server(
      NETWORK === 'testnet'
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org'
    );

    // Cargar cuenta del sponsor
    const sponsorAccount = await server.loadAccount(sponsorKeypair.publicKey());

    // Crear Fee-Bump Transaction
    // El sponsor paga las fees por la transacción del usuario
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      '100000', // Fee que el sponsor pagará (en stroops, 0.01 XLM)
      transaction,
      networkPassphrase
    );

    // Firmar la fee-bump transaction con la llave del sponsor
    feeBumpTx.sign(sponsorKeypair);

    // Retornar la transacción patrocinada en formato XDR
    return NextResponse.json({
      success: true,
      sponsoredTransactionXDR: feeBumpTx.toXDR(),
      sponsorPublicKey: sponsorKeypair.publicKey(),
      fee: '100000',
      message: 'Transacción patrocinada exitosamente. El sponsor pagará las fees.'
    });

  } catch (error: any) {
    console.error('Error al patrocinar transacción:', error);
    return NextResponse.json(
      {
        error: 'Error al patrocinar la transacción',
        details: error.message
      },
      { status: 500 }
    );
  }
}
