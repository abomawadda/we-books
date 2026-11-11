// يبني حزمة الخادم المصغّرة التي تُخزَّن في الشيت ويحمّلها Code.gs الصغير
const fs = require('fs');
const { minify } = require('terser');
(async () => {
  const src = fs.readFileSync(process.argv[2], 'utf8');
  const body = src + '\nreturn { doGet: doGet, doPost: doPost, dailyMaintenanceJob: dailyMaintenanceJob, runDiagnostics: runDiagnostics, initializeDatabaseSchema: initializeDatabaseSchema, setupDailyTriggers: setupDailyTriggers, callServerApi: callServerApi };';
  const wrapped = 'var __b=function(){' + body + '};';
  const out = await minify(wrapped, { compress: { passes: 1 }, mangle: true, format: { comments: false, ascii_only: false } });
  let code = out.code.slice(out.code.indexOf('{') + 1, out.code.lastIndexOf('}'));
  // تأكد أنه قابل للتنفيذ كجسم دالة
  new Function(code);
  fs.writeFileSync(process.argv[3], code);
  console.log('bundle chars', code.length);
})();
