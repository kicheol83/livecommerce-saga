const orderServiceUrl = process.env.ORDER_SERVICE_URL ?? "http://localhost:8081";
const liveServiceUrl = process.env.LIVE_SERVICE_URL ?? "http://localhost:8084";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/orders", destination: `${orderServiceUrl}/api/orders` },
      { source: "/api/orders/:path*", destination: `${orderServiceUrl}/api/orders/:path*` },
      { source: "/api/live/:path*", destination: `${liveServiceUrl}/api/live/:path*` }
    ];
  }
};

export default nextConfig;
