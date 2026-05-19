/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "http://localhost:8742/api/:path*",
        },
      ],
    };
  },
};
export default nextConfig;
