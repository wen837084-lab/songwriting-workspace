import type { NextConfig } from "next";

const isDesktopStaticBuild = process.env.NEXT_PUBLIC_DESKTOP_STATIC === "true";

const nextConfig: NextConfig = {
  agentRules: false,
  ...(isDesktopStaticBuild ? { output: "export" as const } : {}),
};

export default nextConfig;
