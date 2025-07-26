/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['stellar-social-sdk'],
};
