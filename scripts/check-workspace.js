#!/usr/bin/env node

/**
 * check-workspace.js
 *
 * Workspace integrity test for the Elder-Guard monorepo.
 * Verifies that:
 *   1. All expected workspace packages exist
 *   2. Internal workspace dependencies resolve correctly
 *   3. Each package has the required config files
 *   4. No version range prefixes (^ or ~) exist
 *
 * Usage: node scripts/check-workspace.js
 */

const fs = require("fs");
const path = require("path");

const MONOREPO_ROOT = path.resolve(__dirname, "..");

/** All expected workspace packages and their required files */
const EXPECTED_PACKAGES = [
    {
        name: "@elder-guard/core",
        dir: "packages/core",
        requiredFiles: ["package.json", "tsconfig.json", "src/index.ts"],
    },
    {
        name: "@elder-guard/firebase-config",
        dir: "packages/firebase-config",
        requiredFiles: ["package.json", "tsconfig.json", "src/index.ts"],
    },
    {
        name: "@elder-guard/ui",
        dir: "packages/ui",
        requiredFiles: ["package.json", "tsconfig.json", "src/index.ts"],
    },
    {
        name: "@elder-guard/web",
        dir: "apps/web",
        requiredFiles: ["package.json", "tsconfig.json", "next.config.js"],
    },
    {
        name: "@elder-guard/mobile",
        dir: "apps/mobile",
        requiredFiles: ["package.json", "tsconfig.json", "app.json", "metro.config.js"],
    },
];

const DEP_FIELDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
];

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(description, condition) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`   ✅ ${description}`);
    } else {
        failedChecks++;
        console.log(`   ❌ ${description}`);
    }
}

console.log("\n🏗️  Elder-Guard Monorepo — Workspace Integrity Check\n");
console.log("═".repeat(55));

// ── 1. Root config files ──
console.log("\n📁 Root Configuration");
const rootFiles = [
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.json",
    ".npmrc",
    ".gitignore",
    "AGENT.md",
];
for (const file of rootFiles) {
    check(`${file} exists`, fs.existsSync(path.join(MONOREPO_ROOT, file)));
}

// ── 2. pnpm-workspace.yaml content ──
console.log("\n📦 Workspace Configuration");
const workspaceYaml = fs.readFileSync(
    path.join(MONOREPO_ROOT, "pnpm-workspace.yaml"),
    "utf-8"
);
check(
    'pnpm-workspace.yaml contains "apps/*"',
    workspaceYaml.includes("apps/*")
);
check(
    'pnpm-workspace.yaml contains "packages/*"',
    workspaceYaml.includes("packages/*")
);

// ── 3. Package existence and structure ──
console.log("\n📦 Package Structure");
for (const pkg of EXPECTED_PACKAGES) {
    const pkgDir = path.join(MONOREPO_ROOT, pkg.dir);
    console.log(`\n   [${pkg.name}]`);
    check(`Directory exists: ${pkg.dir}`, fs.existsSync(pkgDir));

    for (const file of pkg.requiredFiles) {
        const filePath = path.join(pkgDir, file);
        check(`  ${file} exists`, fs.existsSync(filePath));
    }

    // Verify package name matches
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        check(`  name matches: "${pkg.name}"`, pkgJson.name === pkg.name);
    }
}

// ── 4. Internal dependency resolution ──
console.log("\n\n🔗 Internal Dependencies");
for (const pkg of EXPECTED_PACKAGES) {
    const pkgJsonPath = path.join(MONOREPO_ROOT, pkg.dir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

    for (const field of DEP_FIELDS) {
        const deps = pkgJson[field];
        if (!deps) continue;

        for (const [depName, depVersion] of Object.entries(deps)) {
            if (depName.startsWith("@elder-guard/")) {
                // Verify the referenced workspace package actually exists
                const targetPkg = EXPECTED_PACKAGES.find((p) => p.name === depName);
                check(
                    `${pkg.name} → ${depName} (${depVersion})`,
                    !!targetPkg &&
                    fs.existsSync(path.join(MONOREPO_ROOT, targetPkg.dir, "package.json"))
                );
            }
        }
    }
}

// ── 5. Version pinning check ──
console.log("\n\n🔒 Version Pinning");
let unpinnedCount = 0;
for (const pkg of EXPECTED_PACKAGES) {
    const pkgJsonPath = path.join(MONOREPO_ROOT, pkg.dir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

    for (const field of DEP_FIELDS) {
        const deps = pkgJson[field];
        if (!deps) continue;

        for (const [depName, depVersion] of Object.entries(deps)) {
            if (
                depVersion.startsWith("workspace:") ||
                depVersion.startsWith(">=") ||
                depVersion === "*"
            ) {
                continue;
            }
            if (/^[\^~]/.test(depVersion)) {
                unpinnedCount++;
                console.log(
                    `   ⚠️  ${pkg.name} → ${field}.${depName}: "${depVersion}" (not pinned)`
                );
            }
        }
    }
}
check(`All versions pinned (no ^ or ~)`, unpinnedCount === 0);

// ── 6. TypeScript strict mode ──
console.log("\n\n🔧 TypeScript Configuration");
const rootTsConfig = JSON.parse(
    fs.readFileSync(path.join(MONOREPO_ROOT, "tsconfig.json"), "utf-8")
);
check(
    'Root tsconfig has "strict": true',
    rootTsConfig.compilerOptions?.strict === true
);

// ── Summary ──
console.log("\n" + "═".repeat(55));
console.log(
    `\n📊 Results: ${passedChecks}/${totalChecks} passed, ${failedChecks} failed\n`
);

if (failedChecks > 0) {
    console.log("❌ Workspace integrity check FAILED.\n");
    process.exit(1);
} else {
    console.log("✅ Workspace integrity check PASSED.\n");
    process.exit(0);
}
