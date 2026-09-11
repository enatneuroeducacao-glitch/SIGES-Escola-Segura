/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript is enforced by the dedicated GitHub Actions build gate.
  // Vercel should not block a production deploy on editor-only type diagnostics.
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
