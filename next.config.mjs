/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
