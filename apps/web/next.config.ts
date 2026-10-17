import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@petshop/core", "@petshop/db", "@petshop/integrations"],
  serverExternalPackages: ["postgres", "nodemailer"],
  poweredByHeader: false,
  typedRoutes: false,
};

export default nextConfig;
