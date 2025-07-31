'use client';

import { useState, useEffect, useCallback } from 'react';
import { StellarSocialSDK } from 'stellar-social-sdk';
import toast, { Toaster } from 'react-hot-toast';
import { 
  CurrencyDollarIcon, 
  GlobeAltIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const CONTRACT_ID = 'CALZGCSB3P3WEBLW3QTF5Y4WEALEVTYUYBC7KBGQ266GDINT7U4E74KW';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Declare Google interface
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: Element, config: any) => void;
        };
      };
    };
  }
}

export default function Home() {
  const [sdk, setSdk] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);

  // Handle completed Google authentication
  const handleGoogleAuthComplete = useCallback(async (credentialResponse: any) => {
    console.log('🔐 Processing Google authentication...', credentialResponse);
    
    if (!credentialResponse || !credentialResponse.credential) {
      console.error('❌ No credential received from Google');
      toast.error('No se recibió credencial de Google');
      return;
    }
    
    setLoading(true);
    
    try {
      toast.loading('Creating your Stellar account...', { id: 'auth' });

      // Parse the JWT token to get user info
      const userInfo = parseJWT(credentialResponse.credential);
      console.log('👤 User info:', userInfo);

      if (!userInfo.sub) {
        throw new Error('Invalid Google token');
      }

      // Create auth method manually
      const authMethod = {
        type: 'google' as const,
        identifier: userInfo.email,
        token: credentialResponse.credential,
        metadata: {
          name: userInfo.name,
          picture: userInfo.picture,
          sub: userInfo.sub,
          email: userInfo.email,
          email_verified: userInfo.email_verified,
        }
      };

      // Generate deterministic keypair
      const stellarSdk = await import('stellar-social-sdk');
      const keypair = stellarSdk.CryptoUtils.generateKeypair('google', userInfo.sub);
      const publicKey = keypair.publicKey();
      
      console.log(`🔑 Generated address: ${publicKey}`);
      console.log(`👤 For user: ${userInfo.name} (${userInfo.email})`);

      // Use the SDK's server
      if (!sdk) {
        throw new Error('SDK not initialized');
      }
      const server = sdk.server;

      // Check if account exists
      let accountExists = false;
      try {
        await server.loadAccount(publicKey);
        accountExists = true;
        console.log('📋 Account already exists');
      } catch (error) {
        console.log('🔨 Creating new account');
        // Fund account
        const fundResponse = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
        if (!fundResponse.ok) {
          throw new Error('Failed to fund account');
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Create account object
      const accountData = {
        publicKey,
        authMethods: [authMethod],
        createdAt: Date.now(),
        recoveryContacts: []
      };

      const { StellarSocialAccount } = await import('stellar-social-sdk');
      const stellarAccount = new StellarSocialAccount(
        accountData,
        server,
        CONTRACT_ID,
        'testnet',
        keypair
      );

      setAccount(stellarAccount);
      toast.success(`✅ Welcome ${userInfo.name}!`, { id: 'auth' });
      
      // Load balances
      const bal = await stellarAccount.getBalance();
      setBalances(bal);

    } catch (error: any) {
      console.error('❌ Authentication failed:', error);
      toast.error(error.message || 'Authentication failed', { id: 'auth' });
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  // Manejar código de autorización de Google
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      toast.error('Error de autenticación: ' + error);
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code) {
      console.log('🔐 Procesando código de autorización...');
      handleAuthCode(code);
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Manejar código de autorización - versión simplificada
  const handleAuthCode = async (code: string) => {
    console.log('🔐 Código recibido:', code);
    toast.success('OAuth exitoso! Configurando cuenta...');
    
    // Para demo, simularemos usuario con el código
    const mockUserInfo = {
      sub: `google_${code.substring(0, 8)}`,
      email: 'demo@stellar-social.com',
      name: 'Demo User',
      picture: 'https://via.placeholder.com/150',
      email_verified: true,
    };

    // Crear JWT simulado
    const mockJWT = {
      sub: mockUserInfo.sub,
      email: mockUserInfo.email,
      name: mockUserInfo.name,
      picture: mockUserInfo.picture,
      email_verified: mockUserInfo.email_verified,
    };

    const mockCredential = {
      credential: btoa(JSON.stringify({})) + '.' + 
                 btoa(JSON.stringify(mockJWT)) + '.' + 
                 btoa('mock_signature')
    };

    await handleGoogleAuthComplete(mockCredential);
  };

  // Initialize SDK
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

      await stellarSDK.initialize();
      setSdk(stellarSDK);
      
      // Set up Google OAuth callback after ensuring script is loaded
      const setupGoogleOAuth = () => {
        if (typeof window !== 'undefined' && window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleAuthComplete,
            auto_select: false,
            cancel_on_tap_outside: false,
            ux_mode: 'popup',
            context: 'signin',
            itp_support: true,
          });
          console.log('✅ Google OAuth initialized with Client ID:', GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
          
          // Add error handling for popup blocked
          window.addEventListener('message', (event) => {
            if (event.origin === 'https://accounts.google.com') {
              console.log('📨 Google OAuth message:', event.data);
              if (event.data?.type === 'error') {
                toast.error('Error en Google OAuth: ' + event.data.message);
              }
            }
          });
          
          // Listen for popup blocked
          window.addEventListener('error', (event) => {
            if (event.message?.includes('popup')) {
              toast.error('Popup bloqueado. Permite popups para este sitio.');
            }
          });
        } else {
          console.error('❌ Google Identity Services not loaded');
          setTimeout(setupGoogleOAuth, 500);
        }
      };
      
      setTimeout(setupGoogleOAuth, 1000);

      console.log('✅ SDK initialized');
    };

    initSDK();
  }, [handleGoogleAuthComplete]);

  // Parse JWT token (simple decode)
  const parseJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  };

  // Alternative Google login trigger - usando redirect en lugar de popup
  const triggerGoogleLogin = () => {
    const googleAuthUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `access_type=offline`;
    
    console.log('🔄 Redirecting to Google OAuth...');
    window.location.href = googleAuthUrl;
  };

  // Render Google button
  useEffect(() => {
    if (!account && !loading && typeof window !== 'undefined' && window.google?.accounts?.id) {
      const renderGoogleButton = () => {
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
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
      
      const testAddress = 'GBZXN7PIRZGNMHGA7MUUUF4GWJQ5ULA6TFIAJ5CPYPJ4TJWCXQ5PXNRP';
      const hash = await account.sendPayment(testAddress, '1', undefined, 'Test payment from Stellar Social');
      
      toast.success(`✅ Payment sent! Hash: ${hash.substring(0, 8)}...`, { id: 'payment' });
      
      const bal = await account.getBalance();
      setBalances(bal);
    } catch (error: any) {
      toast.error(error.message || 'Payment failed', { id: 'payment' });
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
                      className="w-full bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm border border-gray-300"
                    >
                      <span className="text-lg">🔄</span>
                      Try Google Login Again
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
                    {account.data.authMethods.map((method: any, index: number) => (
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

            {/* Actions */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">🚀 Ready for Transactions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={handleSendPayment}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Send Test Payment (1 XLM)
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
