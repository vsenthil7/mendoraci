/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow rewriting /api/* to the Fastify API container at build/runtime.
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api:4000';
    return [{ source: '/api/:path*', destination: `${apiBase}/:path*` }];
  },
};
export default nextConfig;
