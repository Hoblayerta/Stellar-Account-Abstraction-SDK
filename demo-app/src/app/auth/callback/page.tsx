'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      router.push('/?error=' + encodeURIComponent(error));
      return;
    }

    if (code) {
      console.log('Got authorization code:', code);
      // Enviar el código de vuelta a la página principal
      router.push('/?code=' + encodeURIComponent(code));
    } else {
      router.push('/?error=no_code');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">Procesando autenticación...</h2>
          <p className="text-purple-200">Redirigiendo de vuelta a la aplicación</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Cargando...</h2>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}