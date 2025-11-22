'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheckIcon, EnvelopeIcon, CodeBracketIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { sendEmailVerification, verifyEmailCode, verifyGitHubToken } from '@/lib/recoveryServerClient';

export const dynamic = 'force-dynamic';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';

type RecoveryStep = 'check-account' | 'setup' | 'email-verify' | 'github-verify' | 'register' | 'complete';

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

interface VerifiedIdentity {
  type: 'email' | 'github';
  value: string;
  verified: boolean;
  metadata?: any;
}

function RecoveryContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<RecoveryStep>('check-account');
  const [stellarAddress, setStellarAddress] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [verifiedIdentities, setVerifiedIdentities] = useState<VerifiedIdentity[]>([]);
  const [pendingCode, setPendingCode] = useState<string>('');
  const [recoverySignerKey, setRecoverySignerKey] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Check for existing account on mount
  useEffect(() => {
    const storedAccount = localStorage.getItem('stellar_account');
    if (storedAccount) {
      try {
        const account = JSON.parse(storedAccount);
        setStellarAddress(account.publicKey);
        checkExistingRecovery(account.publicKey);
      } catch (error) {
        console.error('Failed to load account:', error);
      }
    }
  }, []);

  const checkExistingRecovery = async (address: string) => {
    try {
      const response = await fetch(`/api/recovery/methods?address=${address}`);
      const data = await response.json();

      if (data.identities && data.identities.length > 0) {
        // Account already has recovery methods
        const verified: VerifiedIdentity[] = data.identities.map((id: any) => ({
          type: id.type,
          value: id.value,
          verified: id.authenticated,
          metadata: id.metadata
        }));
        setVerifiedIdentities(verified);
        setStep('complete');
      } else {
        setStep('setup');
      }
    } catch (error) {
      console.error('Failed to check recovery:', error);
      setStep('setup');
    }
  };

  // GitHub OAuth callback
  useEffect(() => {
    const githubStatus = searchParams.get('github');
    if (githubStatus === 'success') {
      const userDataStr = sessionStorage.getItem('github_recovery_user');
      const tokenStr = sessionStorage.getItem('github_access_token');

      if (userDataStr && tokenStr) {
        handleGitHubVerification(JSON.parse(userDataStr), tokenStr);
        sessionStorage.removeItem('github_recovery_user');
        sessionStorage.removeItem('github_access_token');
      }
    } else if (githubStatus === 'error') {
      toast.error('GitHub authentication failed');
    }
  }, [searchParams]);

  const handleGitHubVerification = async (userData: GitHubUser, token: string) => {
    try {
      toast.loading('Verifying GitHub account...', { id: 'github' });

      const result = await verifyGitHubToken(token);

      if (result.verified) {
        setGithubUser(userData);
        setVerifiedIdentities(prev => [...prev, result.identity as VerifiedIdentity]);
        toast.success(`GitHub verified: @${userData.login}`, { id: 'github' });

        if (verifiedIdentities.length > 0) {
          setStep('register');
        }
      } else {
        toast.error('GitHub verification failed', { id: 'github' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message, { id: 'github' });
    }
  };

  const handleEmailSetup = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      toast.loading('Sending verification code...', { id: 'email' });
      const result = await sendEmailVerification(email);

      if (result.success) {
        // In development, server returns the code
        if (result.code) {
          setPendingCode(result.code);
          toast.success(`Demo: Code is ${result.code}`, { id: 'email', duration: 10000 });
        } else {
          toast.success('Verification code sent to your email', { id: 'email' });
        }
        setStep('email-verify');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send code';
      toast.error(message, { id: 'email' });
    }
  };

  const handleEmailVerify = async () => {
    if (!emailCode || emailCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    try {
      toast.loading('Verifying code...', { id: 'verify' });
      const result = await verifyEmailCode(email, emailCode);

      if (result.verified) {
        toast.success('Email verified!', { id: 'verify' });
        setVerifiedIdentities(prev => [...prev, result.identity as VerifiedIdentity]);
        setStep('register');
      } else {
        toast.error('Invalid code', { id: 'verify' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast.error(message, { id: 'verify' });
    }
  };

  const handleGitHubSetup = () => {
    if (!GITHUB_CLIENT_ID) {
      toast.error('GitHub not configured');
      return;
    }

    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('github_oauth_state', state);

    const redirectUri = `${window.location.origin}/recovery/github/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=user:email`;

    window.location.href = authUrl;
  };

  const handleRegisterAccount = async () => {
    if (!stellarAddress) {
      toast.error('No Stellar account found. Please login first.');
      return;
    }

    if (verifiedIdentities.length === 0) {
      toast.error('Please verify at least one recovery method');
      return;
    }

    setIsRegistering(true);

    try {
      toast.loading('Registering account with recovery server...', { id: 'register' });

      const response = await fetch('/api/recovery/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stellarAddress,
          identities: verifiedIdentities
        })
      });

      const data = await response.json();

      if (data.success) {
        setRecoverySignerKey(data.signer.key);
        toast.success('Account registered with recovery server!', { id: 'register' });
        setStep('complete');
      } else {
        toast.error(data.error || 'Registration failed', { id: 'register' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast.error(message, { id: 'register' });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <ShieldCheckIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Account Recovery Setup</h1>
                <p className="text-emerald-200 text-sm">SEP-30 Social Recovery</p>
              </div>
            </div>
            <Link href="/" className="text-emerald-200 hover:text-white transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Info Card */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 mb-8">
          <h3 className="text-xl font-semibold text-white mb-3">🛡️ SEP-30 Account Recovery</h3>
          <p className="text-blue-100 text-sm mb-3">
            Set up recovery methods to regain access if you lose your device. Recovery servers hold encrypted signing keys that can help you recover your account.
          </p>
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-100">
            <strong>⚠️ Testnet Demo:</strong> This implementation demonstrates SEP-30 concepts but is NOT production-ready.
            Missing: SEP-10 authentication, transaction validation. See PRODUCTION_ROADMAP.md for details.
          </div>
        </div>

        {/* No Account Warning */}
        {step === 'check-account' && !stellarAddress && (
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">No Account Found</h2>
            <p className="text-yellow-100 mb-6">
              Please login or create an account first to set up recovery methods.
            </p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-3 px-6 rounded-xl transition-all"
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Setup Flow */}
        {step === 'setup' && stellarAddress && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
              <div className="text-emerald-200 text-sm mb-2">Your Stellar Address</div>
              <div className="text-white font-mono text-sm break-all">{stellarAddress}</div>
            </div>

            <h2 className="text-2xl font-bold text-white">Choose Recovery Methods</h2>

            {/* Email Recovery */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Email Recovery</h3>
                  <p className="text-emerald-200 text-sm mb-4">
                    Receive verification codes via email for account recovery
                  </p>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white text-sm placeholder-white/40 focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      onClick={handleEmailSetup}
                      disabled={!email}
                      className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
                    >
                      Setup Email Recovery
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* GitHub Recovery */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CodeBracketIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">GitHub OAuth Recovery</h3>
                  <p className="text-emerald-200 text-sm mb-4">
                    Use your GitHub account as a recovery method
                  </p>
                  <button
                    onClick={handleGitHubSetup}
                    disabled={!GITHUB_CLIENT_ID}
                    className="w-full bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CodeBracketIcon className="w-5 h-5" />
                    {GITHUB_CLIENT_ID ? 'Setup GitHub Recovery' : 'GitHub Not Configured'}
                  </button>
                  {!GITHUB_CLIENT_ID && (
                    <p className="text-yellow-300 text-xs mt-2">
                      Add NEXT_PUBLIC_GITHUB_CLIENT_ID to .env.local
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Verification */}
        {step === 'email-verify' && (
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
                className="w-full bg-black/30 border border-white/20 rounded-xl p-4 text-white text-center text-2xl font-mono placeholder-white/40 focus:border-emerald-400 focus:outline-none"
              />
              <button
                onClick={handleEmailVerify}
                disabled={emailCode.length !== 6}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                Verify Code
              </button>
              <button
                onClick={() => setStep('setup')}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Register Account */}
        {step === 'register' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Register with Recovery Server</h2>

            <div className="bg-black/30 rounded-xl p-6 mb-6">
              <h3 className="text-white font-semibold mb-3">Verified Identities</h3>
              <div className="space-y-3">
                {verifiedIdentities.map((identity, i) => (
                  <div key={i} className="flex items-center gap-3 bg-green-500/20 rounded-lg p-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <div className="text-white font-medium capitalize">{identity.type} Recovery</div>
                      <div className="text-green-300 text-sm">{identity.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-6 text-sm text-blue-100">
              <p>The recovery server will:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-blue-200">
                <li>Generate an encrypted signing key for your account</li>
                <li>Store your verified recovery identities</li>
                <li>Enable account recovery if you lose access</li>
              </ul>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleRegisterAccount}
                disabled={isRegistering}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                {isRegistering ? 'Registering...' : 'Register Account'}
              </button>
              <button
                onClick={() => setStep('setup')}
                disabled={isRegistering}
                className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-all"
              >
                Add More Methods
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-md rounded-2xl p-8 border border-green-500/30">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheckIcon className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Recovery Setup Complete!</h2>
              <p className="text-green-100 mb-6">
                Your account is now protected with SEP-30 recovery
              </p>

              <div className="bg-black/30 rounded-xl p-6 mb-6">
                <h3 className="text-white font-semibold mb-3">Registered Recovery Methods</h3>
                <div className="space-y-3">
                  {verifiedIdentities.map((identity, i) => (
                    <div key={i} className="flex items-center gap-3 bg-green-500/20 rounded-lg p-3">
                      {identity.type === 'email' && <EnvelopeIcon className="w-5 h-5 text-green-400" />}
                      {identity.type === 'github' && identity.metadata?.avatar_url && (
                        <img
                          src={identity.metadata.avatar_url}
                          alt={identity.metadata.login}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium capitalize">{identity.type} Recovery</div>
                        <div className="text-green-300 text-sm">
                          {identity.type === 'github' && identity.metadata?.login
                            ? `@${identity.metadata.login}`
                            : identity.value}
                        </div>
                      </div>
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    </div>
                  ))}
                </div>
              </div>

              {recoverySignerKey && (
                <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 mb-6 text-left">
                  <h3 className="text-white font-semibold mb-2 text-sm">Recovery Signer Public Key</h3>
                  <p className="text-purple-200 font-mono text-xs break-all">{recoverySignerKey}</p>
                  <p className="text-purple-300 text-xs mt-2">
                    This signing key is stored encrypted on the recovery server
                  </p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Link
                  href="/recover"
                  className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  Test Recovery Flow
                </Link>
                <Link
                  href="/"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  Back to Wallet
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="animate-spin h-8 w-8 border-4 border-white/30 border-t-white rounded-full mx-auto"></div>
        </div>
      </div>
    }>
      <RecoveryContent />
    </Suspense>
  );
}
