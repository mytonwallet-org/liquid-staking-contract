import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 150000,
    // Submodules under contracts/ ship their own tests that expect to run from
    // their own repos (they look up wrappers like `Voting`, `JettonWallet` that
    // don't exist here under those names). Skip them in the parent project run.
    testPathIgnorePatterns: ['/node_modules/', '/contracts/']
};

export default config;
