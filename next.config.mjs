/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Allow video API to handle large files  
  async headers() {
    return [
      {
        source: '/api/video/:path*',
        headers: [
          { key: 'Accept-Ranges', value: 'bytes' },
        ],
      },
    ]
  },
};

export default nextConfig;
