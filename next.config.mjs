/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Docker optimization
  output: 'standalone',
  
  // FORCE Next.js to include these modules in the standalone/node_modules folder
  experimental: {
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/bcryptjs/**/*',
        './node_modules/tsx/**/*'
      ],
    },
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;