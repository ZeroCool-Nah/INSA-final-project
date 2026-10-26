/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Blocks the app from being embedded in an iframe on another
          // site — the standard defense against clickjacking a login/
          // status-change page.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing a response into executing
          // as something other than its declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Forces HTTPS for a year, including subdomains, once a browser
          // has seen this once. No effect on plain `pnpm dev` over http,
          // but should be in place before this is ever deployed for real.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
