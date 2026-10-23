import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pg', 'sharp'],
  // Permite que la prueba automática (npm run test:webhook) use una carpeta de compilación separada
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
