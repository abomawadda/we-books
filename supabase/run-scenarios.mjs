import { createRequire } from 'node:module';
import * as mock from './test-mock.mjs';
global.__SB_MOCK = mock;
process.env.SCENARIO_MOCK = new URL('./scenarios-entry.cjs', import.meta.url).pathname;
createRequire(import.meta.url)('../test/scenarios.test.js');
