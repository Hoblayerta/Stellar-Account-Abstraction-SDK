'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get OAuth code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          throw new Error(`GitHub OAuth error: ${errorParam}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Verify state (CSRF protection)
        const storedState = sessionStorage.getItem('github_oauth_state');
        if (state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        sessionStorage.removeItem('github_oauth_state');

        console.log('🔐 Processing GitHub OAuth callback...');
        toast.loading('Authenticating with GitHub...', { id: 'github-auth' });

        // Exchange code for user info via our API (server-side)
        const redirectUri = `${window.location.origin}/recovery/github/callback`;
        const response = await fetch('/api/github-oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            redirectUri
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'GitHub authentication failed');
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error('Invalid response from GitHub OAuth');
        }

        console.log('✅ GitHub authentication successful:', data.user.login);

        // Store user info in sessionStorage for recovery page
        sessionStorage.setItem('github_recovery_user', JSON.stringify(data.user));

        toast.success(`GitHub authenticated: ${data.user.login}`, { id: 'github-auth' });

        // Redirect back to recovery page
        setTimeout(() => {
          router.push('/recovery?github=success');
        }, 1500);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ GitHub OAuth callback failed:', error);
        setError(message);
        toast.error(message, { id: 'github-auth', duration: 5000 });

        setTimeout(() => {
          router.push('/recovery?github=error');
        }, 3000);
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <Toaster position="top-right" />

      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheckIcon className="w-10 h-10 text-white" />
          </div>

          {processing && (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">Authenticating with GitHub</h1>
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin h-8 w-8 border-4 border-white/30 border-t-white rounded-full"></div>
                <span className="text-white">Processing OAuth callback...</span>
              </div>
            </>
          )}

          {error && (
            <>
              <h1 className="text-2xl font-bold text-red-400 mb-4">Authentication Failed</h1>
              <p className="text-red-200 mb-4">{error}</p>
              <p className="text-white/60 text-sm">Redirecting back to recovery page...</p>
            </>
          )}

          {!processing && !error && (
            <>
              <h1 className="text-2xl font-bold text-green-400 mb-4">Success!</h1>
              <p className="text-green-200 mb-4">GitHub authentication complete</p>
              <p className="text-white/60 text-sm">Redirecting...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="animate-spin h-8 w-8 border-4 border-white/30 border-t-white rounded-full mx-auto"></div>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
