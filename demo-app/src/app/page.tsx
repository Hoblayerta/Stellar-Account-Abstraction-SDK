'use client';

import { useState, useEffect } from 'react';
import { StellarSocialSDK } from 'stellar-social-sdk';
import toast, { Toaster } from 'react-hot-toast';
import { 
  UserIcon, 
  CurrencyDollarIcon, 
  GlobeAltIcon,
  PhoneIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

const CONTRACT_ID = 'CALZGCSB3P3WEBLW3QTF5Y4WEALEVTYUYBC7KBGQ266GDINT7U4E74KW';

interface AuthResult {
  success: boolean;
  account?: any;
  error?: string;
}

export default function Home() {
  const [sdk] = useState(() => new StellarSocialSDK({
    contractId: CONTRACT_ID,
    network: 'testnet'
  }));
  
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    sdk.initialize();
  }, [sdk]);

  const handleAuth = async (type: string) => {
    setLoading(true);
    let result: AuthResult;

    try {
      switch (type) {
        case 'google':
          toast.loading('Authenticating with Google...', { id: 'auth' });
          result = await sdk.authenticateWithGoogle();
          break;
        case 'facebook':
          toast.loading('Authenticating with Facebook...', { id: 'auth' });
          result = await sdk.authenticateWithFacebook();
          break;
        case 'phone':
          if (!phoneNumber || !verificationCode) {
            toast.error('Please enter phone number and verification code');
            return;
          }
          toast.loading('Verifying phone number...', { id: 'auth' });
          result = await sdk.authenticateWithPhone({
            phoneNumber,
            verificationCode
          });
          break;
        case 'freighter':
          toast.loading('Connecting to Freighter...', { id: 'auth' });
          result = await sdk.connectFreighter();
          break;
        default:
          return;
      }

      if (result.success && result.account) {
        setAccount(result.account);
        toast.success(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} connected!`, { id: 'auth' });
        
        // Load balances
        const bal = await result.account.getBalance();
        setBalances(bal);
      } else {
        toast.error(result.error || 'Authentication failed', { id: 'auth' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed', { id: 'auth' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendPayment = async () => {
    if (!account) return;

    try {
      toast.loading('Sending test payment...', { id: 'payment' });
      
      // Send 1 XLM to a random test address
      const testAddress = 'GBZXN7PIRZGNMHGA7MUUUF4GWJQ5ULA6TFIAJ5CPYPJ4TJWCXQ5PXNRP';
      const hash = await account.sendPayment(testAddress, '1', undefined, 'Test payment from social wallet');
      
      toast.success(`Payment sent! Hash: ${hash.substring(0, 8)}...`, { id: 'payment' });
      
      // Refresh balances
      const bal = await account.getBalance();
      setBalances(bal);
    } catch (error: any) {
      toast.error(error.message || 'Payment failed', { id: 'payment' });
    }
  };

  const disconnect = () => {
    setAccount(null);
    setBalances([]);
    setPhoneNumber('');
    setVerificationCode('');
    toast.success('Disconnected');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <GlobeAltIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Stellar Social</h1>
                <p className="text-purple-200 text-sm">Social Login SDK for Stellar</p>
              </div>
            </div>
            <div className="text-purple-200 text-xs">
              Contract: {CONTRACT_ID.substring(0, 8)}...
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!account ? (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Login with Social Accounts
            </h2>
            <p className="text-xl text-purple-200 mb-8">
              Connect using Google, Facebook, Phone, or Crypto Wallets
            </p>

            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {/* Social Login Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-6">Social Login</h3>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleAuth('google')}
                    disabled={loading}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">📧</span>
                    Continue with Google
                  </button>

                  <button
                    onClick={() => handleAuth('facebook')}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">📘</span>
                    Continue with Facebook
                  </button>

                  <div className="space-y-3">
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-200"
                    />
                    <input
                      type="text"
                      placeholder="Verification code (use 123456)"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-200"
                    />
                    <button
                      onClick={() => handleAuth('phone')}
                      disabled={loading}
                      className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3"
                    >
                      <PhoneIcon className="w-5 h-5" />
                      Verify Phone
                    </button>
                  </div>
                </div>
              </div>

              {/* Crypto Wallet Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-6">Crypto Wallets</h3>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleAuth('freighter')}
                    disabled={loading}
                    className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">🦊</span>
                    Connect Freighter
                  </button>

                  <div className="text-purple-300 text-sm text-center">
                    More wallets coming soon...
                  </div>
                </div>
              </div>
            </div>

            {loading && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl px-6 py-3">
                  <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                  <span className="text-white">Processing...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Account Info */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Account Connected</h3>
                <button
                  onClick={disconnect}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-xl transition-all"
                >
                  Disconnect
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-purple-200 text-sm mb-2">Stellar Address</label>
                  <div className="bg-black/30 rounded-xl p-4 font-mono text-white text-sm break-all">
                    {account.publicKey}
                  </div>
                </div>
                
                <div>
                  <label className="block text-purple-200 text-sm mb-2">Auth Methods</label>
                  <div className="space-y-2">
                    {account.authMethods.map((method: any, index: number) => (
                      <div key={index} className="bg-black/30 rounded-xl p-3 text-white text-sm">
                        <div className="flex items-center gap-2">
                          <span className="capitalize font-medium">{method.type}</span>
                          <span className="text-purple-300">•</span>
                          <span className="text-purple-200">{method.identifier}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">Account Balances</h3>
              <div className="space-y-3">
                {balances.map((balance, index) => (
                  <div key={index} className="flex items-center justify-between bg-black/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <CurrencyDollarIcon className="w-6 h-6 text-yellow-400" />
                      <span className="text-white font-medium">{balance.asset}</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{parseFloat(balance.balance).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={handleSendPayment}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Send Test Payment
                </button>
                
                <button
                  onClick={() => {
                    const newMethod = {
                      type: 'passkey' as const,
                      identifier: 'demo-passkey-' + Date.now(),
                      metadata: { demo: true }
                    };
                    account.addAuthMethod(newMethod);
                    toast.success('Demo passkey added!');
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <KeyIcon className="w-5 h-5" />
                  Add Passkey (Demo)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/5 backdrop-blur-md border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-purple-200">
            <p className="mb-2">Built for Stellar Ecosystem</p>
            <p className="text-sm">Testnet Demo • Contract: {CONTRACT_ID}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
