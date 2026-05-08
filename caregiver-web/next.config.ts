import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  // Suppress Leaflet-related SSR warnings — Map is loaded via dynamic(ssr:false)
  serverExternalPackages: ['leaflet'],
};

export default nextConfig;
