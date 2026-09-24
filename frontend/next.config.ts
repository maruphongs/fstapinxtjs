import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*", // Proxy to FastAPI
      },
      {
        source: "/graphql",
        destination: "http://127.0.0.1:8000/graphql", // Proxy to FastAPI GraphQL
      },
    ];
  },
};

export default nextConfig;