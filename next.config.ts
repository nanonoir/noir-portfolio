import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        // Action confirmations render a minimal HTML form and an inline script
        // that reads the token from the URL fragment. Keep this exception
        // isolated to token routes; API JSON and webhook routes execute no JS.
        source: "/api/meetings/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
