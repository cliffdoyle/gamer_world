/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
    reactStrictMode: true, // Or whatever other configs you have
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '', // Usually empty for standard https
        pathname: '/a/**', // Allows any path under /a/ which is common for Google user profile pics
      },
      // You can add other hostnames here if needed
      // {
      //   protocol: 'https',
      //   hostname: 'another-image-provider.com',
      // },
    ],
  },
  
};

module.exports = nextConfig; 