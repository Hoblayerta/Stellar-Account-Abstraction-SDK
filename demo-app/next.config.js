/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['stellar-social-sdk'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://accounts.google.com https://horizon-testnet.stellar.org https://friendbot.stellar.org",
              "frame-src 'self' https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; ')
          }
        ]
      }
    ]
  }
};
