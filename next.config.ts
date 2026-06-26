import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Prevent Cloudflare/CDN from caching HTML pages.
        // Next.js sets s-maxage=31536000 for static-looking pages, but after each
        // deploy the JS chunk filenames change — serving stale HTML causes blank pages.
        // Static assets under /_next/static/ are content-hashed and should stay cached.
        source: "/((?!_next/static|_next/image|favicon\\.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
