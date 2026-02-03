import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'youke.xn--y7xa690gmna.cn',
        pathname: '/s1/**',
      },
    ],
  },
};

export default nextConfig;
