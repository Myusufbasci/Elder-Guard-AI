/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^@elder-guard/core$": "<rootDir>/../../packages/core/src/index",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/src/__tests__/__mocks__/async-storage.ts",
  },
  modulePaths: [
    "<rootDir>/../../packages/core/node_modules",
    "<rootDir>/node_modules",
    "<rootDir>/../../node_modules",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!(zustand)/)",
  ],
};
