import type {NextConfig} from "next";
const pagesBuild = process.env.GITHUB_PAGES === "true";
const config: NextConfig = {
  env: {NEXT_PUBLIC_DOCS_BASE_PATH: pagesBuild ? (process.env.PAGES_BASE_PATH ?? "") : ""},
  ...(pagesBuild ? {
    output: "export",
    basePath: process.env.PAGES_BASE_PATH ?? "",
    trailingSlash: true,
    images: {unoptimized: true},
  } : {}),
  transpilePackages: ["@xlt/registry"], devIndicators: false,
  experimental: {optimizePackageImports: ["lucide-react"]}};
export default config;
