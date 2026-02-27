// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  testTimeout: 10000, // 全局默认 10 秒
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^d3-(.+)$': '<rootDir>/node_modules/d3-$1/dist/d3-$1.js',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
