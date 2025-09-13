'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StellarSocialSDK } from 'stellar-social-sdk';
import toast, { Toaster } from 'react-hot-toast';
import { 
  CurrencyDollarIcon, 
  GlobeAltIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

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
      toast.loading(`Sending ${paymentAmount} XLM...`, { id: 'payment' });
      
      const hash = await account.sendPayment(
        recipientAddress.trim(), 
        paymentAmount, 
        undefined, 
        `SS: ${paymentAmount} XLM`
      );
      
      toast.success(`✅ Payment sent! Hash: ${hash.substring(0, 8)}...`, { id: 'payment' });
      
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
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">⚠️ Configuration Required</h1>
          <p className="text-red-200 mb-4">Please add your Google Client ID to .env.local</p>
        </div>
      </div>
    );
  }

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
                <p className="text-purple-200 text-sm">Real Social Login for Stellar</p>
              </div>
            </div>
            <div className="text-purple-200 text-xs flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-400" />
              OAuth Ready
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!account ? (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Connect Your Real Accounts
            </h2>
            <p className="text-xl text-purple-200 mb-8">
              Authentic OAuth integration with deterministic Stellar addresses
            </p>

            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {/* Social Login Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-6">🔐 Real OAuth Login</h3>
                
                <div className="space-y-4">
                  {/* Google OAuth Button */}
                  <div className="space-y-2">
                    <div id="google-signin-button" className="w-full min-h-[48px] flex items-center justify-center">
                      {loading && (
                        <div className="flex items-center gap-2 text-white">
                          <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                          Creating account...
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-purple-200 text-center">
                      Uses Google Identity Services
                    </p>
                    
                    {/* Alternative trigger button */}
                    <button
                      onClick={triggerGoogleLogin}
                      disabled={loading}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <span className="text-lg">🔄</span>
                      Trigger Google One Tap
                    </button>
                  </div>

                  <button
                    onClick={handleFacebookAuth}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    <span className="text-xl">📘</span>
                    Facebook (Demo)
                  </button>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-white mb-6">ℹ️ How it works</h3>
                
                <div className="space-y-3 text-purple-200 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">1.</span>
                    <span>Login with your real Google account</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">2.</span>
                    <span>We generate your unique Stellar address</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">3.</span>
                    <span>Same login = same address always</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">4.</span>
                    <span>Start transacting on Stellar testnet</span>
                  </div>
                </div>
              </div>
            </div>

            {loading && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl px-6 py-3">
                  <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                  <span className="text-white">Setting up your Stellar account...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Account Success */}
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-md rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">🎉 Stellar Account Ready!</h3>
                <button
                  onClick={disconnect}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-xl transition-all"
                >
                  Disconnect
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-purple-200 text-sm mb-2">🌟 Your Stellar Address</label>
                  <div className="bg-black/30 rounded-xl p-4 font-mono text-white text-sm break-all">
                    {account.publicKey}
                  </div>
                  <p className="text-xs text-green-300 mt-1">
                    ✓ Deterministic • ✓ Always the same for your Google account
                  </p>
                </div>
                
                <div>
                  <label className="block text-purple-200 text-sm mb-2">👤 Account Info</label>
                  <div className="bg-black/30 rounded-xl p-3 text-white text-sm">
                    {account.data.authMethods.map((method: { type: string; metadata?: { name?: string; email?: string } }, index: number) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span className="capitalize font-medium">{method.type}</span>
                        </div>
                        {method.metadata?.name && (
                          <div className="text-purple-200">👤 {method.metadata.name}</div>
                        )}
                        {method.metadata?.email && (
                          <div className="text-purple-200">📧 {method.metadata.email}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">💰 Testnet Balances</h3>
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

            {/* Send Payment */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">💸 Send XLM Payment</h3>
              
              <div className="space-y-4">
                {/* Recipient Address */}
                <div>
                  <label className="block text-purple-200 text-sm mb-2">Recipient Stellar Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white font-mono text-sm placeholder-white/40 focus:border-purple-400 focus:outline-none"
                    maxLength={56}
                  />
                  {recipientAddress && !isValidStellarAddress(recipientAddress) && (
                    <p className="text-red-300 text-xs mt-1">Invalid Stellar address format</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-purple-200 text-sm mb-2">Amount (XLM)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="1.0"
                    min="0.000001"
                    step="0.1"
                    className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white text-sm placeholder-white/40 focus:border-purple-400 focus:outline-none"
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendPayment}
                  disabled={sendingPayment || !recipientAddress.trim() || !isValidStellarAddress(recipientAddress) || parseFloat(paymentAmount) <= 0}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  {sendingPayment ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <CurrencyDollarIcon className="w-5 h-5" />
                      Send {paymentAmount} XLM
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">🚀 Account Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setRecipientAddress(account.publicKey);
                    setPaymentAmount('0.1');
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  📝 Self Payment Test
                </button>
                
                <button
                  onClick={() => {
                    window.open(`https://stellar.expert/explorer/testnet/account/${account.publicKey}`, '_blank');
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  🔍 View on Explorer
                </button>
              </div>
              
              <div className="mt-4 text-center text-green-300 text-sm">
                ✅ Authenticated • ✅ Funded • ✅ Ready for transactions
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
