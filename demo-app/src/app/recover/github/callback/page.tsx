'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function GitHubCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const storedState = sessionStorage.getItem('github_oauth_state');

      // Verify state parameter
      if (!state || state !== storedState) {
        setError('Invalid state parameter - possible CSRF attack');
        setTimeout(() => router.push('/recover?github=error'), 2000);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setTimeout(() => router.push('/recover?github=error'), 2000);
        return;
      }

      try {
        // Exchange code for access token via our API
        const response = await fetch('/api/github-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (!data.access_token) {
          throw new Error('No access token received');
        }

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        const userData = await userResponse.json();

        // Store user data and token for recovery page
        sessionStorage.setItem('github_recovery_user', JSON.stringify(userData));
        sessionStorage.setItem('github_access_token', data.access_token);
        sessionStorage.removeItem('github_oauth_state');

        // Redirect back to recovery page
        router.push('/recover?github=success');
      } catch (err) {
        console.error('GitHub OAuth error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => router.push('/recover?github=error'), 2000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full">
        <div className="text-center">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">❌</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
              <p className="text-red-200 text-sm mb-4">{error}</p>
              <p className="text-purple-300 text-xs">Redirecting...</p>
            </>
          ) : (
            <>
              <div className="animate-spin h-12 w-12 border-4 border-purple-500/30 border-t-white rounded-full mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-white mb-2">Authenticating with GitHub</h2>
              <p className="text-purple-200 text-sm">Please wait...</p>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-purple-500/30 border-t-white rounded-full"></div>
      </div>
    }>
      <GitHubCallbackContent />
    </Suspense>
  );
}
