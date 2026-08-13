const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Points at the Next.js app root so next/jest can load next.config.js
  // and .env files, and so it can read tsconfig.json's `paths` to resolve
  // the `@/*` alias automatically — no manual moduleNameMapper needed.
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

// createJestConfig is exported this way so next/jest can load the (async)
// Next.js config before handing off to Jest.
module.exports = createJestConfig(customJestConfig);
