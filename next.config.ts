import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "exceljs"],
  typescript: {
    ignoreBuildErrors: true
  }
  /* config options here */
};

export default nextConfig;
