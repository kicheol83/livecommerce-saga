const gatewayUrl = process.env.GATEWAY_URL ?? "http://localhost:8080";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${gatewayUrl}/api/:path*` }];
  }
};

export default nextConfig;
