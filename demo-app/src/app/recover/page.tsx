'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheckIcon, EnvelopeIcon, CodeBracketIcon, KeyIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { sendEmailVerification, verifyEmailCode, verifyGitHubToken, getAccountInfo } from '@/lib/recoveryServerClient';

type RecoveryStep = 'identify' | 'verify-email' | 'verify-github' | 'recovery-complete';

interface RecoveryIdentity {
  type: 'email' | 'github';
  value: string;
  authenticated: boolean;
  metadata?: any;
}

function RecoverContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<RecoveryStep>('identify');
  const [stellarAddress, setStellarAddress] = useState('');
  const [availableIdentities, setAvailableIdentities] = useState<RecoveryIdentity[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'github' | null>(null);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [verifiedIdentity, setVerifiedIdentity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle GitHub OAuth callback
  useEffect(() => {
    const githubStatus = searchParams.get('github');
    if (githubStatus === 'success') {
      const userDataStr = sessionStorage.getItem('github_recovery_user');
      const tokenStr = sessionStorage.getItem('github_access_token');
      const recoveryAddress = sessionStorage.getItem('recovery_stellar_address');

      if (userDataStr && tokenStr && recoveryAddress) {
        handleGitHubVerification(JSON.parse(userDataStr), tokenStr);
        setStellarAddress(recoveryAddress);
        sessionStorage.removeItem('github_recovery_user');
        sessionStorage.removeItem('github_access_token');
        sessionStorage.removeItem('recovery_stellar_address');
      }
    } else if (githubStatus === 'error') {
      toast.error('GitHub authentication failed');
    }
  }, [searchParams]);

  const handleGitHubVerification = async (userData: any, token: string) => {
    try {
      toast.loading('Verifying GitHub account...', { id: 'github' });
      const result = await verifyGitHubToken(token);

      if (result.verified) {
        toast.success(`GitHub verified: @${userData.login}`, { id: 'github' });
        setVerifiedIdentity(result.identity);
        handleRecoverySuccess();
      } else {
        toast.error('GitHub verification failed', { id: 'github' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message, { id: 'github' });
    }
  };

  const handleLookupAccount = async () => {
    if (!stellarAddress || stellarAddress.length !== 56 || !stellarAddress.startsWith('G')) {
      toast.error('Please enter a valid Stellar address');
      return;
    }

    setIsLoading(true);

    try {
      toast.loading('Looking up account...', { id: 'lookup' });
      const accountInfo = await getAccountInfo(stellarAddress);

      if (accountInfo.identities.length === 0) {
        toast.error('No recovery methods found for this account', { id: 'lookup' });
        return;
      }

      setAvailableIdentities(accountInfo.identities as RecoveryIdentity[]);
      toast.success(`Found ${accountInfo.identities.length} recovery method(s)`, { id: 'lookup' });
      setStep('identify');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Account lookup failed';
      if (message.includes('not found')) {
        toast.error('Account not registered with recovery server', { id: 'lookup' });
      } else {
        toast.error(message, { id: 'lookup' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmail = async (emailIdentity: RecoveryIdentity) => {
    setSelectedMethod('email');
    setEmail(emailIdentity.value);

    try {
      toast.loading('Sending verification code...', { id: 'email' });
      const result = await sendEmailVerification(emailIdentity.value);

      if (result.success) {
        if (result.code) {
          setPendingCode(result.code);
          toast.success(`Demo: Code is ${result.code}`, { id: 'email', duration: 10000 });
        } else {
          toast.success('Verification code sent', { id: 'email' });
        }
        setStep('verify-email');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send code';
      toast.error(message, { id: 'email' });
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    try {
      toast.loading('Verifying code...', { id: 'verify' });
      const result = await verifyEmailCode(email, emailCode);

      if (result.verified) {
        toast.success('Email verified!', { id: 'verify' });
        setVerifiedIdentity(result.identity);
        handleRecoverySuccess();
      } else {
        toast.error('Invalid code', { id: 'verify' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message, { id: 'verify' });
    }
  };

  const handleSelectGitHub = () => {
    setSelectedMethod('github');
    const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!GITHUB_CLIENT_ID) {
      toast.error('GitHub not configured');
      return;
    }

    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('github_oauth_state', state);
    sessionStorage.setItem('recovery_stellar_address', stellarAddress);

    const redirectUri = `${window.location.origin}/recover/github/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=user:email`;

    window.location.href = authUrl;
  };

  const handleRecoverySuccess = () => {
    setStep('recovery-complete');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <KeyIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Account Recovery</h1>
                <p className="text-purple-200 text-sm">Regain access to your wallet</p>
              </div>
            </div>
            <Link href="/" className="text-purple-200 hover:text-white transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Info Card */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl p-6 border border-amber-500/30 mb-8">
          <h3 className="text-xl font-semibold text-white mb-3">🔑 Recover Your Account</h3>
          <p className="text-amber-100 text-sm mb-3">
            Lost access to your device? Use your registered recovery methods to regain control of your account.
          </p>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-100">
            <strong>ℹ️ What Works:</strong> Identity verification with recovery server (email/GitHub).
            <strong className="ml-2">What's Missing:</strong> Stellar transaction execution (see PRODUCTION_ROADMAP.md).
          </div>
        </div>

        {/* Step 1: Enter Address and Choose Method */}
        {step === 'identify' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">Enter Your Stellar Address</h2>

              <div className="space-y-4">
                <input
                  type="text"
                  value={stellarAddress}
                  onChange={(e) => setStellarAddress(e.target.value)}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  maxLength={56}
                  className="w-full bg-black/30 border border-white/20 rounded-xl p-4 text-white font-mono text-sm placeholder-white/40 focus:border-purple-400 focus:outline-none"
                />
                <button
                  onClick={handleLookupAccount}
                  disabled={isLoading || stellarAddress.length !== 56}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  {isLoading ? 'Looking up...' : 'Lookup Account'}
                </button>
              </div>
            </div>

            {/* Available Recovery Methods */}
            {availableIdentities.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Choose Recovery Method</h2>
                <div className="space-y-4">
                  {availableIdentities.map((identity, i) => (
                    <div key={i} className="bg-black/30 rounded-xl p-6 border border-white/10">
                      {identity.type === 'email' && (
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <EnvelopeIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">Email Recovery</h3>
                            <p className="text-purple-200 text-sm mb-3">{identity.value}</p>
                            <button
                              onClick={() => handleSelectEmail(identity)}
                              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium py-2 px-6 rounded-lg transition-all"
                            >
                              Recover via Email
                            </button>
                          </div>
                        </div>
                      )}

                      {identity.type === 'github' && (
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                            <CodeBracketIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">GitHub Recovery</h3>
                            <p className="text-purple-200 text-sm mb-3">
                              {identity.metadata?.login ? `@${identity.metadata.login}` : identity.value}
                            </p>
                            <button
                              onClick={handleSelectGitHub}
                              className="bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center gap-2"
                            >
                              <CodeBracketIcon className="w-5 h-5" />
                              Recover via GitHub
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Verify Email */}
        {step === 'verify-email' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Verify Your Email</h2>

            {pendingCode && (
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-6">
                <p className="text-blue-100 text-sm mb-2">Demo Mode: Your verification code</p>
                <p className="text-white font-mono text-2xl text-center">{pendingCode}</p>
                <p className="text-blue-200 text-xs mt-2 text-center">
                  In production, this would be sent to {email}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full bg-black/30 border border-white/20 rounded-xl p-4 text-white text-center text-2xl font-mono placeholder-white/40 focus:border-purple-400 focus:outline-none"
              />
              <button
                onClick={handleVerifyEmail}
                disabled={emailCode.length !== 6}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                Verify & Recover Account
              </button>
              <button
                onClick={() => setStep('identify')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Recovery Complete */}
        {step === 'recovery-complete' && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-md rounded-2xl p-8 border border-green-500/30">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Identity Verified!</h2>
              <p className="text-green-100 mb-6">
                Your recovery identity has been verified with the recovery server.
              </p>

              <div className="bg-black/30 rounded-xl p-6 mb-6">
                <h3 className="text-white font-semibold mb-3">Verified Identity</h3>
                {verifiedIdentity && (
                  <div className="bg-green-500/20 rounded-lg p-4">
                    <div className="text-white font-medium capitalize">{verifiedIdentity.type} Recovery</div>
                    <div className="text-green-300 text-sm mt-1">{verifiedIdentity.value}</div>
                  </div>
                )}
              </div>

              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-6 text-sm text-left">
                <p className="font-semibold text-green-100 mb-2">✅ What's Working:</p>
                <ol className="list-decimal list-inside space-y-1 text-green-200">
                  <li>Recovery server verified your identity</li>
                  <li>Account exists in recovery database</li>
                  <li>Recovery signing key is stored encrypted</li>
                  <li>Ready to sign recovery transactions</li>
                </ol>
              </div>

              <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 mb-6 text-sm text-left">
                <p className="font-semibold text-amber-100 mb-2">⚠️ Missing for Production:</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-200">
                  <li><strong>SEP-10 Authentication:</strong> No proof you own the Stellar account</li>
                  <li><strong>Transaction Validation:</strong> Server doesn't verify transaction before signing</li>
                  <li><strong>Recovery Execution:</strong> Demo stops at verification, doesn't create new keypair or submit to Stellar</li>
                </ol>
                <p className="text-amber-100 text-xs mt-2">
                  See <code className="bg-black/30 px-1 rounded">PRODUCTION_ROADMAP.md</code> for implementation details.
                </p>
              </div>

              <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 mb-6 text-xs text-purple-200 text-left">
                <p className="font-semibold mb-1">Complete Recovery Flow (Not Implemented):</p>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Generate new device keypair on new device</li>
                  <li>Build Stellar transaction (Set Options: add new signer)</li>
                  <li>Request recovery server signature with verified identity</li>
                  <li>Sign transaction with new device key</li>
                  <li>Submit fully-signed transaction to Stellar network</li>
                  <li>New device key added → account recovered</li>
                </ol>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setStep('identify');
                    setStellarAddress('');
                    setAvailableIdentities([]);
                    setEmailCode('');
                    setPendingCode('');
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  Recover Another Account
                </button>
                <Link
                  href="/"
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  Back to Wallet
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* How Recovery Works */}
        <div className="mt-8 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-semibold mb-3">🛡️ How SEP-30 Recovery Works</h3>
          <div className="space-y-2 text-sm text-purple-200">
            <p>1. <strong>Setup:</strong> Register recovery identities (email, GitHub) with recovery server</p>
            <p>2. <strong>Server Generates Key:</strong> Recovery server creates and encrypts a signing key</p>
            <p>3. <strong>Lost Access:</strong> Verify your identity when you lose your device</p>
            <p>4. <strong>Server Signs:</strong> Recovery server signs transaction to add new device key</p>
            <p>5. <strong>Recovered:</strong> You regain access with your new device</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="animate-spin h-8 w-8 border-4 border-white/30 border-t-white rounded-full mx-auto"></div>
        </div>
      </div>
    }>
      <RecoverContent />
    </Suspense>
  );
}
