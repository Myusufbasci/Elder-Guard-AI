const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the monorepo root
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * Watch the monorepo root so Metro can resolve workspace symlinks.
 * This prevents "module not found" errors for @elder-guard/* packages.
 */
config.watchFolders = [monorepoRoot];

/**
 * Let Metro know where to resolve packages from.
 * 1. The project's own node_modules
 * 2. The monorepo root's node_modules (for hoisted deps)
 */
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
