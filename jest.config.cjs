/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  roots: ["<rootDir>/src", "<rootDir>/test"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
  clearMocks: true,
  // Coverage settings (only active when running with --coverage)
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
    "!src/main.ts",
    "!src/application/bootstrap.ts",
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "<rootDir>/coverage",
};
