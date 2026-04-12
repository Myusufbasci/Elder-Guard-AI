/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@elder-guard/core$": "<rootDir>/../../packages/core/src/index.ts",
        "^@elder-guard/firebase-config$": "<rootDir>/../../packages/firebase-config/src/index.ts",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
            },
        ],
    },
};
