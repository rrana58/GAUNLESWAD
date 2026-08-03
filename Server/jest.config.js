module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  testMatch: ["**/tests/unit/**/*.test.js"],
  testTimeout: 30000,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "models/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "services/**/*.js",
    "!**/node_modules/**",
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true,
};
