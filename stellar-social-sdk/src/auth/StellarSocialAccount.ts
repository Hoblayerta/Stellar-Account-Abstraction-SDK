import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo
} from '@stellar/stellar-sdk';
import { AuthMethod, SocialAccountData } from '../types/index.js';
import {
  RecoveryConfig,
  RecoveryIdentity,
  RecoverySigner,
  RecoveryAuthMethod
} from '../types/recovery.js';

export class StellarSocialAccount {
  private keypair?: Keypair;
  private server: Horizon.Server;
  private contractId: string;
  private network: string;
  public data: SocialAccountData;
  private recoverySigners: RecoverySigner[] = [];
  private recoveryIdentities: RecoveryIdentity[] = [];

  constructor(
    data: SocialAccountData,
    server: Horizon.Server,
    contractId: string,
    network: string,
    keypair?: Keypair
  ) {
    this.data = data;
    this.server = server;
    this.contractId = contractId;
    this.network = network;
    this.keypair = keypair;
  }

  get publicKey(): string {
    return this.data.publicKey;
  }

  get authMethods(): AuthMethod[] {
    return this.data.authMethods;
  }

  /**
   * Send payment to another account
   */
  async sendPayment(
    destination: string,
    amount: string,
    asset: Asset = Asset.native(),
    memo?: string
  ): Promise<string> {
    if (!this.keypair) {
      throw new Error('No keypair available for signing. Use social auth recovery.');
    }

    try {
      const account = await this.server.loadAccount(this.publicKey);
      
      const txBuilder = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
      });

      txBuilder.addOperation(
        Operation.payment({
          destination,
          asset,
          amount,
        })
      );

      if (memo) {
        // Stellar text memos have a 28-byte limit
        const truncatedMemo = memo.length > 28 ? memo.substring(0, 28) : memo;
        txBuilder.addMemo(Memo.text(truncatedMemo));
      }

      const transaction = txBuilder.setTimeout(300).build();
      transaction.sign(this.keypair);

      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error: any) {
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  /**
   * Send gasless payment - El sponsor paga las fees
   * @param destination Dirección de destino
   * @param amount Cantidad a enviar
   * @param sponsorApiUrl URL del API endpoint del sponsor (default: /api/sponsor-transaction)
   * @param asset Asset a enviar (default: XLM nativo)
   * @param memo Memo opcional
   */
  async sendGaslessPayment(
    destination: string,
    amount: string,
    sponsorApiUrl: string = '/api/sponsor-transaction',
    asset: Asset = Asset.native(),
    memo?: string
  ): Promise<{ hash: string; sponsorPublicKey: string }> {
    if (!this.keypair) {
      throw new Error('No keypair available for signing. Use social auth recovery.');
    }

    try {
      console.log('💸 Creando transacción gasless...');

      const account = await this.server.loadAccount(this.publicKey);

      // Crear transacción con fee=0 (el sponsor pagará)
      const txBuilder = new TransactionBuilder(account, {
        fee: '0',
        networkPassphrase: this.network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
      });

      txBuilder.addOperation(
        Operation.payment({
          destination,
          asset,
          amount,
        })
      );

      if (memo) {
        const truncatedMemo = memo.length > 28 ? memo.substring(0, 28) : memo;
        txBuilder.addMemo(Memo.text(truncatedMemo));
      }

      const transaction = txBuilder.setTimeout(300).build();

      // Firmar la transacción original con la llave del usuario
      transaction.sign(this.keypair);

      // Enviar al sponsor para que agregue fee-bump
      console.log('📤 Enviando transacción al sponsor...');
      const response = await fetch(sponsorApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionXDR: transaction.toXDR(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al contactar al sponsor');
      }

      const { sponsoredTransactionXDR, sponsorPublicKey } = await response.json();

      console.log('✅ Transacción patrocinada por:', sponsorPublicKey);

      // Enviar la transacción patrocinada a la red
      console.log('📡 Enviando transacción patrocinada a la red...');
      const feeBumpTx = new (TransactionBuilder as any).fromXDR(
        sponsoredTransactionXDR,
        this.network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC
      );

      const result = await this.server.submitTransaction(feeBumpTx);

      console.log('✅ Transacción gasless completada!');
      return {
        hash: result.hash,
        sponsorPublicKey
      };
    } catch (error: any) {
      console.error('❌ Error en transacción gasless:', error.message);
      throw new Error(`Gasless payment failed: ${error.message}`);
    }
  }

  /**
   * Add new authentication method - Simplified for MVP
   */
  async addAuthMethod(newMethod: AuthMethod): Promise<boolean> {
    // Para MVP, solo actualizar localmente
    // En producción, llamar al contrato Soroban
    this.data.authMethods.push(newMethod);
    console.log(`✅ Added auth method: ${newMethod.type}`);
    return true;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ balance: string; asset: string }[]> {
    try {
      const account = await this.server.loadAccount(this.publicKey);
      return account.balances.map((balance: any) => ({
        balance: balance.balance,
        asset: balance.asset_type === 'native' ? 'XLM' : 
               `${balance.asset_code}:${balance.asset_issuer}`
      }));
    } catch (error: any) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Initialize account with contract (for new accounts)
   */
  async initializeWithContract(): Promise<boolean> {
    if (!this.keypair) {
      console.log('⚠️ No keypair available, skipping contract initialization');
      return true; // For MVP, this is OK
    }

    try {
      console.log('🔧 Initializing account with social contract...');

      // For MVP, we'll skip the actual contract call
      // In production, this would call the contract's initialize function
      console.log(`✅ Account initialized: ${this.publicKey}`);
      return true;

    } catch (error: any) {
      console.error('Contract initialization failed:', error.message);
      return false;
    }
  }

  /**
   * SEP-30: Register recovery identities
   */
  async registerRecoveryIdentity(identity: RecoveryIdentity): Promise<boolean> {
    try {
      console.log('🔐 Registering recovery identity...');

      // Validate auth methods
      for (const method of identity.authMethods) {
        if (!this.isValidAuthMethod(method)) {
          throw new Error(`Invalid auth method: ${method.type}`);
        }
      }

      this.recoveryIdentities.push(identity);
      console.log(`✅ Recovery identity registered with ${identity.authMethods.length} auth method(s)`);

      // In production, this would call SEP-30 recovery server API:
      // POST /accounts/{address} with identity data

      return true;
    } catch (error: any) {
      console.error('❌ Failed to register recovery identity:', error.message);
      return false;
    }
  }

  /**
   * SEP-30: Add recovery signer
   */
  async addRecoverySigner(config: RecoveryConfig): Promise<boolean> {
    if (!this.keypair) {
      throw new Error('No keypair available for signing transaction');
    }

    try {
      console.log('🔑 Adding recovery signers...');

      // Generate recovery server signers
      const signers: RecoverySigner[] = [];
      for (const serverConfig of config.servers) {
        // In production, recovery server would generate this
        const recoveryKeypair = Keypair.random();
        signers.push({
          key: recoveryKeypair.publicKey(),
          added: new Date().toISOString()
        });
      }

      // Build transaction to add signers
      const account = await this.server.loadAccount(this.publicKey);
      const txBuilder = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
      });

      // Set account thresholds
      txBuilder.addOperation(
        Operation.setOptions({
          lowThreshold: config.accountThreshold.low,
          medThreshold: config.accountThreshold.medium,
          highThreshold: config.accountThreshold.high,
        })
      );

      // Add each recovery signer with appropriate weight
      for (const signer of signers) {
        txBuilder.addOperation(
          Operation.setOptions({
            signer: {
              ed25519PublicKey: signer.key,
              weight: config.signerWeight.recoveryServer
            }
          })
        );
      }

      // Update device key weight
      txBuilder.addOperation(
        Operation.setOptions({
          signer: {
            ed25519PublicKey: this.publicKey,
            weight: config.signerWeight.device
          }
        })
      );

      const transaction = txBuilder.setTimeout(300).build();
      transaction.sign(this.keypair);

      await this.server.submitTransaction(transaction);

      this.recoverySigners = signers;
      console.log(`✅ Added ${signers.length} recovery signer(s)`);
      return true;

    } catch (error: any) {
      console.error('❌ Failed to add recovery signers:', error.message);
      return false;
    }
  }

  /**
   * SEP-30: Initiate account recovery
   */
  async initiateRecovery(
    newDeviceKeypair: Keypair,
    recoveryAuthMethods: RecoveryAuthMethod[]
  ): Promise<boolean> {
    try {
      console.log('🔄 Initiating account recovery...');

      // Verify recovery auth methods
      for (const method of recoveryAuthMethods) {
        const identity = this.recoveryIdentities.find(id =>
          id.authMethods.some(am => am.type === method.type && am.value === method.value)
        );

        if (!identity) {
          throw new Error(`No registered recovery identity for ${method.type}: ${method.value}`);
        }
      }

      // In production, this would:
      // 1. Authenticate with recovery servers using auth methods
      // 2. Request transaction signatures from recovery servers
      // 3. Build transaction to replace device key
      // 4. Submit multi-signed transaction

      console.log('📝 Recovery transaction would replace device key:');
      console.log(`   Old: ${this.publicKey}`);
      console.log(`   New: ${newDeviceKeypair.publicKey()}`);

      // For MVP, simulate recovery
      console.log('✅ Recovery initiated (simulated)');
      return true;

    } catch (error: any) {
      console.error('❌ Recovery failed:', error.message);
      return false;
    }
  }

  /**
   * SEP-30: Complete account recovery
   */
  async completeRecovery(
    signedTransactionXDR: string
  ): Promise<string> {
    try {
      console.log('✅ Submitting recovery transaction...');

      const transaction = TransactionBuilder.fromXDR(
        signedTransactionXDR,
        this.network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC
      );

      const result = await this.server.submitTransaction(transaction as any);
      console.log('✅ Account recovered successfully');
      return result.hash;

    } catch (error: any) {
      console.error('❌ Recovery submission failed:', error.message);
      throw error;
    }
  }

  /**
   * Get recovery identities
   */
  getRecoveryIdentities(): RecoveryIdentity[] {
    return this.recoveryIdentities;
  }

  /**
   * Get recovery signers
   */
  getRecoverySigners(): RecoverySigner[] {
    return this.recoverySigners;
  }

  /**
   * Validate recovery auth method
   */
  private isValidAuthMethod(method: RecoveryAuthMethod): boolean {
    switch (method.type) {
      case 'email':
        return this.isValidEmail(method.value);
      case 'phone_number':
        return this.isValidPhone(method.value);
      case 'stellar_address':
        return this.isValidStellarAddress(method.value);
      default:
        return false;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // E.164 format: +[country code][number]
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  private isValidStellarAddress(address: string): boolean {
    return address.startsWith('G') && address.length === 56;
  }
}
