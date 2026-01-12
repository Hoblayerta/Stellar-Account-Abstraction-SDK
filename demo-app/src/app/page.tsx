'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StellarSocialSDK } from 'stellar-social-sdk';
import toast, { Toaster } from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

const CONTRACT_ID = 'CALZGCSB3P3WEBLW3QTF5Y4WEALEVTYUYBC7KBGQ266GDINT7U4E74KW';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;



interface CredentialResponse {
  credential: string;
}


interface BalanceInfo {
  asset: string;
  balance: string;
}

export default function Home() {
  const [sdk, setSdk] = useState<StellarSocialSDK | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<BalanceInfo[]>([]);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('1');
  const [sendingPayment, setSendingPayment] = useState(false);
  const [useGasless, setUseGasless] = useState(false);
  
  // Use refs to access current state in callbacks
  const sdkRef = useRef<StellarSocialSDK | null>(null);
  const setLoadingRef = useRef(setLoading);
  const setAccountRef = useRef(setAccount);
  const setBalancesRef = useRef(setBalances);
  
  // Update refs when state changes
  useEffect(() => {
    sdkRef.current = sdk;
  }, [sdk]);
  
  useEffect(() => {
    setLoadingRef.current = setLoading;
    setAccountRef.current = setAccount;
    setBalancesRef.current = setBalances;
  }, [setLoading, setAccount, setBalances]);

  // Handle completed Google authentication
  const handleGoogleAuthComplete = useCallback(async (credentialResponse: CredentialResponse) => {
    try {
      console.log('🔐 Processing Google authentication...', credentialResponse);
      
      if (!credentialResponse) {
        console.error('❌ No credential response received from Google');
        toast.error('No credential response received from Google');
        return;
      }

      if (!credentialResponse.credential) {
        console.error('❌ No credential in response from Google');
        toast.error('No credential in response from Google');
        return;
      }
      
      setLoadingRef.current(true);
      toast.loading('Creating your Stellar account...', { id: 'auth' });

      // Get current SDK instance from ref
      const currentSdk = sdkRef.current;
      if (!currentSdk) {
        throw new Error('SDK not initialized');
      }

      console.log('🔑 Processing credential with SDK...');
      
      // Use the new SDK method to handle the credential
      const result = await currentSdk.authenticateWithGoogleCredential(credentialResponse);
      
      if (result.success && result.account) {
        setAccountRef.current(result.account);
        
        // Get user info from the account
        const authMethod = result.account.data.authMethods[0];
        const userName = authMethod.metadata?.name || 'User';
        
        console.log('✅ Authentication successful for:', userName);
        toast.success(`✅ Welcome ${userName}!`, { id: 'auth' });
        
        // Load balances
        const bal = await result.account.getBalance();
        setBalancesRef.current(bal);
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      console.error('❌ Authentication failed:', error);
      toast.error(errorMessage, { id: 'auth' });
    } finally {
      setLoadingRef.current(false);
    }
  }, []); // No dependencies - stable callback

  // Clean up URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');

    if (errorParam) {
      toast.error('Authentication error: ' + errorParam);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Initialize SDK (only once)
  useEffect(() => {
    const initSDK = async () => {
      if (!GOOGLE_CLIENT_ID) {
        toast.error('Google Client ID not configured');
        return;
      }

      console.log('🚀 Initializing SDK...');

      const stellarSDK = new StellarSocialSDK({
        contractId: CONTRACT_ID,
        network: 'testnet',
        googleClientId: GOOGLE_CLIENT_ID
      });

      setSdk(stellarSDK);
      console.log('✅ SDK initialized');
    };

    initSDK();
  }, []); // No dependencies - only run once

  // Set up Google OAuth (when SDK is available)
  useEffect(() => {
    if (!sdk) return;
    
    const setupGoogleOAuth = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        try {
          // Set global callback before initializing
          window.handleGoogleCredential = handleGoogleAuthComplete;
          
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID!,
            callback: handleGoogleAuthComplete,
            auto_select: false,
            cancel_on_tap_outside: false,
            ux_mode: 'popup',
            context: 'signin',
            itp_support: true,
            use_fedcm_for_prompt: true
          });
          console.log('✅ Google OAuth initialized with Client ID:', GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
        } catch (error) {
          console.error('❌ Error initializing Google OAuth:', error);
          toast.error('Failed to initialize Google authentication');
        }
        
      } else {
        console.error('❌ Google Identity Services not loaded, retrying...');
        setTimeout(setupGoogleOAuth, 500);
      }
    };
    
    // Wait for Google script to load
    setTimeout(setupGoogleOAuth, 1000);
  }, [sdk]); // Only depend on sdk


  // Alternative Google login trigger - using One Tap
  const triggerGoogleLogin = () => {
    if (window.google?.accounts?.id) {
      console.log('🔄 Triggering Google One Tap...');
      window.google.accounts.id.prompt();
    } else {
      toast.error('Google Identity Services not loaded');
    }
  };

  // Render Google button
  useEffect(() => {
    if (!account && !loading && typeof window !== 'undefined' && window.google?.accounts?.id) {
      const renderGoogleButton = () => {
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer && window.google?.accounts?.id) {
          buttonContainer.innerHTML = '';
          window.google.accounts.id.renderButton(buttonContainer, {
            type: 'standard',
            shape: 'rectangular',
            theme: 'filled_blue',
            text: 'signin_with',
            size: 'large',
            width: '100%',
          });
        }
      };

      // Delay to ensure Google OAuth is initialized
      setTimeout(renderGoogleButton, 1500);
    }
  }, [account, loading]);

  const handleFacebookAuth = async () => {
    if (!sdk) return;
    
    setLoading(true);
    try {
      toast.loading('Authenticating with Facebook...', { id: 'auth' });
      const result = await sdk.authenticateWithFacebook();
      
      if (result.success && result.account) {
        setAccount(result.account);
        toast.success('✅ Facebook connected!', { id: 'auth' });
        
        const bal = await result.account.getBalance();
        setBalances(bal);
      } else {
        toast.error(result.error || 'Authentication failed', { id: 'auth' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      toast.error(errorMessage, { id: 'auth' });
    } finally {
      setLoading(false);
    }
  };

  // Validate Stellar address
  const isValidStellarAddress = (address: string): boolean => {
    if (!address) return false;
    // Stellar addresses are 56 characters long and start with G
    return /^G[A-Z2-7]{55}$/.test(address);
  };

  const handleSendPayment = async () => {
    if (!account) return;

    // Validate inputs
    if (!recipientAddress.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }

    if (!isValidStellarAddress(recipientAddress.trim())) {
      toast.error('Invalid Stellar address. Must be 56 characters starting with G');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    try {
      setSendingPayment(true);

      if (useGasless) {
        // Transacción Gasless - El sponsor paga
        toast.loading(`Sending ${paymentAmount} XLM (gasless)...`, { id: 'payment' });

        const result = await account.sendGaslessPayment(
          recipientAddress.trim(),
          paymentAmount,
          '/api/sponsor-transaction',
          undefined,
          `Gasless: ${paymentAmount} XLM`
        );

        toast.success(
          `✅ Gasless payment sent! Sponsor: ${result.sponsorPublicKey.substring(0, 8)}... Hash: ${result.hash.substring(0, 8)}...`,
          { id: 'payment', duration: 5000 }
        );
      } else {
        // Transacción Normal - Usuario paga
        toast.loading(`Sending ${paymentAmount} XLM...`, { id: 'payment' });

        const hash = await account.sendPayment(
          recipientAddress.trim(),
          paymentAmount,
          undefined,
          `SS: ${paymentAmount} XLM`
        );

        toast.success(`✅ Payment sent! Hash: ${hash.substring(0, 8)}...`, { id: 'payment' });
      }

      // Clear form
      setRecipientAddress('');
      setPaymentAmount('1');

      // Refresh balances
      const bal = await account.getBalance();
      setBalances(bal);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      toast.error(errorMessage, { id: 'payment' });
    } finally {
      setSendingPayment(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setBalances([]);
    toast.success('Disconnected');
  };

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 max-w-md shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">⚠️ Configuration Required</h1>
          <p className="text-red-700 mb-4">Please add your Google Client ID to .env.local</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image
                src="/accesly-logo.png"
                alt="Accesly"
                width={140}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="text-gray-600 text-xs flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full">
              <CheckCircleIcon className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700 font-medium">OAuth Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!account ? (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Connect Your Real Accounts
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Authentic OAuth integration with deterministic Stellar addresses
            </p>

            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {/* Social Login Card */}
              <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">🔐 Real OAuth Login</h3>

                <div className="space-y-4">
                  {/* Google OAuth Button */}
                  <div className="space-y-2">
                    <div id="google-signin-button" className="w-full min-h-[48px] flex items-center justify-center">
                      {loading && (
                        <div className="flex items-center gap-2 text-purple-600">
                          <div className="animate-spin h-5 w-5 border-2 border-purple-200 border-t-purple-600 rounded-full"></div>
                          Creating account...
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      Uses Google Identity Services
                    </p>

                    {/* Alternative trigger button */}
                    <button
                      onClick={triggerGoogleLogin}
                      disabled={loading}
                      className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
                    >
                      <span className="text-lg">🔄</span>
                      Trigger Google One Tap
                    </button>
                  </div>

                  <button
                    disabled={true}
                    className="w-full bg-black hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-md relative"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <span>GitHub</span>
                    <span className="absolute top-1 right-1 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      SOON
                    </span>
                  </button>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">ℹ️ How it works</h3>

                <div className="space-y-3 text-gray-700 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">1.</span>
                    <span>Login with your real Google account</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">2.</span>
                    <span>We generate your unique Stellar address</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">3.</span>
                    <span>Same login = same address always</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">4.</span>
                    <span>Start transacting on Stellar testnet</span>
                  </div>
                </div>
              </div>
            </div>

            {loading && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-6 py-3">
                  <div className="animate-spin h-5 w-5 border-2 border-purple-200 border-t-purple-600 rounded-full"></div>
                  <span className="text-purple-900">Setting up your Stellar account...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Account Success */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Account Ready!</h3>
                <button
                  onClick={disconnect}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl transition-all font-medium"
                >
                  Disconnect
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-medium text-sm mb-2">🌟 Your Stellar Address</label>
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-4 font-mono text-gray-800 text-sm break-all">
                    {account.publicKey}
                  </div>
                  <p className="text-xs text-purple-600 mt-1 font-medium">
                    ✓ Deterministic • ✓ Always the same for your Google account
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium text-sm mb-2">👤 Account Info</label>
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-3 text-gray-800 text-sm">
                    {account.data.authMethods.map((method: { type: string; metadata?: { name?: string; email?: string } }, index: number) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600">✓</span>
                          <span className="capitalize font-medium">{method.type}</span>
                        </div>
                        {method.metadata?.name && (
                          <div className="text-gray-600">👤 {method.metadata.name}</div>
                        )}
                        {method.metadata?.email && (
                          <div className="text-gray-600">📧 {method.metadata.email}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Testnet Balances</h3>
              <div className="space-y-3">
                {balances.map((balance, index) => (
                  <div key={index} className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
                      <span className="text-gray-900 font-medium">{balance.asset}</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-700">{parseFloat(balance.balance).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Payment */}
            <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Send XLM Payment</h3>

              <div className="space-y-4">
                {/* Gasless Toggle */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-900 font-medium">
                          {useGasless ? '⚡ Gasless Mode' : '💳 Normal Mode'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs">
                        {useGasless
                          ? 'El sponsor pagará las fees de esta transacción'
                          : 'Tú pagarás las fees (~0.00001 XLM)'}
                      </p>
                    </div>
                    <button
                      onClick={() => setUseGasless(!useGasless)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        useGasless ? 'bg-[#7C3AED]' : 'bg-gray-400'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          useGasless ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {useGasless && (
                    <div className="mt-2 text-purple-700 text-xs flex items-center gap-1 font-medium">
                      <span>✓</span>
                      <span>Esta transacción será patrocinada por el desarrollador</span>
                    </div>
                  )}
                </div>

                {/* Recipient Address */}
                <div>
                  <label className="block text-gray-700 font-medium text-sm mb-2">Recipient Stellar Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full bg-white border-2 border-purple-200 rounded-xl p-3 text-gray-900 font-mono text-sm placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                    maxLength={56}
                  />
                  {recipientAddress && !isValidStellarAddress(recipientAddress) && (
                    <p className="text-red-500 text-xs mt-1 font-medium">Invalid Stellar address format</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-gray-700 font-medium text-sm mb-2">Amount (XLM)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="1.0"
                    min="0.000001"
                    step="0.1"
                    className="w-full bg-white border-2 border-purple-200 rounded-xl p-3 text-gray-900 text-sm placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendPayment}
                  disabled={sendingPayment || !recipientAddress.trim() || !isValidStellarAddress(recipientAddress) || parseFloat(paymentAmount) <= 0}
                  className={`w-full ${
                    useGasless
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6]'
                      : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
                  } disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg`}
                >
                  {sendingPayment ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      {useGasless ? `Send ${paymentAmount} XLM (Gasless)` : `Send ${paymentAmount} XLM`}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Account Actions</h3>

              <button
                onClick={() => {
                  window.open(`https://stellar.expert/explorer/testnet/account/${account.publicKey}`, '_blank');
                }}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
              >
                🔍 View on Explorer
              </button>

              <div className="mt-4 text-center text-purple-700 text-sm font-medium">
                ✅ Authenticated • ✅ Funded • ✅ Ready for transactions
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
