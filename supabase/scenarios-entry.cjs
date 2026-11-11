// غلاف CommonJS لأن scenarios.test.js متزامن ويستخدم require
module.exports = { makeContext: (clock) => global.__SB_MOCK.makeContext(clock) };
