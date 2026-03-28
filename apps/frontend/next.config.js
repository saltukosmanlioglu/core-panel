/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@core-panel/shared'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
