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

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
if (process.env.NODE_ENV === 'development') {
  void import('@opennextjs/cloudflare').then(
    ({ initOpenNextCloudflareForDev }) => {
      initOpenNextCloudflareForDev();
    },
  );
}
