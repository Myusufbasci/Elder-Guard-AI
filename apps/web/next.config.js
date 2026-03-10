/** @type {import('next').NextConfig} */
const nextConfig = {
    /**
     * Transpile workspace packages so Next.js can bundle them correctly.
     * This prevents "module not found" errors for monorepo symlinks.
     */
    transpilePackages: [
        "@elder-guard/core",
        "@elder-guard/ui",
        "@elder-guard/firebase-config",
    ],
};

module.exports = nextConfig;
