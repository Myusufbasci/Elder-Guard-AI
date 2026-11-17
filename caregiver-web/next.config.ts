import type { NextConfig } from 'next';

// Origins allowed for Server Actions — required when behind a reverse proxy
// (nginx) that rewrites x-forwarded-host to the internal service name.
// Resolved at BUILD time; comma-separated env var lets a deployment override
// the defaults without editing this file.
const allowedOrigins = (
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ??
  '167.172.163.112,eldercare_web,localhost:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  // Suppress Leaflet-related SSR warnings — Map is loaded via dynamic(ssr:false)
  serverExternalPackages: ['leaflet'],
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
