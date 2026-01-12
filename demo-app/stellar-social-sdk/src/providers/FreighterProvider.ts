import { AuthMethod } from '../types';

export class FreighterProvider {
  /**
   * Check if Freighter is installed
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.freighter;
  }

  /**
   * Connect to Freighter wallet
   */
  async connect(): Promise<AuthMethod> {
    if (!this.isInstalled()) {
      throw new Error('Freighter wallet not installed. Please install from https://freighter.app');
    }

    try {
      const { publicKey } = await window.freighter!.requestAccess();
      
      return {
        type: 'freighter',
        identifier: publicKey,
        metadata: {
          walletType: 'freighter',
          connected: true
        }
      };
    } catch (error) {
      throw new Error(`Failed to connect to Freighter: ${error}`);
    }
  }

  /**
   * Get current network from Freighter
   */
  async getNetwork(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Freighter not installed');
    }

    const { network } = await window.freighter!.getNetwork();
    return network;
  }

  /**
   * Sign transaction with Freighter
   */
  async signTransaction(transaction: string, network: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Freighter not installed');
    }

    const { signedTxn } = await window.freighter!.signTransaction(transaction, network);
    return signedTxn;
  }
}