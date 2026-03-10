#!/usr/bin/env node

/**
 * pin-versions.js
 *
 * Scans all package.json files in the monorepo and removes all ^ and ~
 * prefixes from dependency versions to enforce strict version pinning.
 *
 * Usage: node scripts/pin-versions.js [--check]
 *   --check  Only report violations without modifying files (for CI)
 */

const fs = require("fs");
const path = require("path");

const MONOREPO_ROOT = path.resolve(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");

const DEP_FIELDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
];

/**
 * Recursively find all package.json files in the monorepo,
 * skipping node_modules and hidden directories.
 */
function findPackageJsonFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...findPackageJsonFiles(fullPath));
        } else if (entry.name === "package.json") {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * Strip ^ and ~ prefixes from a version string.
 * Skips workspace:*, file:, and link: protocols.
 */
function pinVersion(version) {
    if (
        version.startsWith("workspace:") ||
        version.startsWith("file:") ||
        version.startsWith("link:") ||
        version.startsWith("npm:") ||
        version === "*" ||
        version === "latest"
    ) {
        return version;
    }
    return version.replace(/^[\^~]/, "");
}

let totalViolations = 0;
let totalFixed = 0;
const packageFiles = findPackageJsonFiles(MONOREPO_ROOT);

console.log(`\n🔍 Scanning ${packageFiles.length} package.json files...\n`);

for (const filePath of packageFiles) {
    const relativePath = path.relative(MONOREPO_ROOT, filePath);
    const raw = fs.readFileSync(filePath, "utf-8");
    const pkg = JSON.parse(raw);
    let modified = false;
    const fileViolations = [];

    for (const field of DEP_FIELDS) {
        const deps = pkg[field];
        if (!deps) continue;

        for (const [name, version] of Object.entries(deps)) {
            const pinned = pinVersion(version);
            if (pinned !== version) {
                fileViolations.push({ field, name, from: version, to: pinned });
                deps[name] = pinned;
                modified = true;
            }
        }
    }

    if (fileViolations.length > 0) {
        console.log(`📦 ${relativePath}`);
        for (const v of fileViolations) {
            console.log(`   ${v.field} → ${v.name}: "${v.from}" → "${v.to}"`);
        }
        totalViolations += fileViolations.length;

        if (!CHECK_ONLY && modified) {
            fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
            totalFixed += fileViolations.length;
            console.log(`   ✅ Fixed!\n`);
        } else {
            console.log(`   ⚠️  Needs fixing\n`);
        }
    }
}

console.log("─".repeat(50));

if (totalViolations === 0) {
    console.log("✅ All versions are properly pinned. No ^ or ~ found.\n");
    process.exit(0);
} else if (CHECK_ONLY) {
    console.log(
        `\n❌ Found ${totalViolations} unpinned version(s). Run without --check to fix.\n`
    );
    process.exit(1);
} else {
    console.log(`\n✅ Fixed ${totalFixed} version(s) across all package.json files.\n`);
    process.exit(0);
}
