/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  /**
   * Fast default: native FS watchers. If you hit EMFILE on macOS, run `npm run dev:poll` instead
   * (polling is slower but avoids “too many open files”).
   */
  webpack: (config, { dev }) => {
    if (dev && process.env.NEXT_DEV_POLLING === "1") {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
