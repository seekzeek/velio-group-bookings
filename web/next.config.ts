import type { NextConfig } from "next";

// Every page is a client of the backend API, so the server rendering features stay off and nothing is prerendered with data.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
