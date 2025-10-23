/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "local-origin.dev", 
    "*.local-origin.dev",
    "10.192.105.148:3000", // Your computer's IP for mobile access
    "10.231.53.148", // Your phone's IP
    "10.*", // Allow all 10.x.x.x network
    "192.168.*", // Allow all 192.168.x.x network
    "172.16.*", // Allow some 172.x.x.x networks
    "172.17.*",
    "172.18.*",
    "172.19.*",
    "172.20.*",
    "172.21.*",
    "172.22.*",
    "172.23.*",
    "172.24.*",
    "172.25.*",
    "172.26.*",
    "172.27.*",
    "172.28.*",
    "172.29.*",
    "172.30.*",
    "172.31.*"
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
