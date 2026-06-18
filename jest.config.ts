import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 150000,
    testPathIgnorePatterns: ['/node_modules/', '/contracts/']
};

export default config;
