import type { NextConfig } from "next";

const nextConfig: any = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Task 30: the server makes the PDF of each approved tech file revision. The PDF library and the image library run as
  // plain Node packages, and the logo file travels with the routes that make the PDF.
  serverExternalPackages: ['@react-pdf/renderer', 'sharp'],
  outputFileTracingIncludes: {
    '/api/replications/*': ['./public/logo.png'],
    '/api/replications/*/revisions/*/pdf': ['./public/logo.png'],
  },
};

export default nextConfig;
