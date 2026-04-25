/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Docker optimization
  output: 'standalone',

  // FORCE Next.js to include these modules in the standalone/node_modules folder
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/bcryptjs/**/*'
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
