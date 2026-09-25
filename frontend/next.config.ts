import type { NextConfig } from 'next';
const config: NextConfig = {
  async rewrites() {
    // Vercel Services routes /api to FastAPI at the project ingress.
    if (process.env.VERCEL === '1') return [];
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL || 'http://127.0.0.1:8000'}/api/:path*` }];
  },
  devIndicators: false,
};
export default config;
