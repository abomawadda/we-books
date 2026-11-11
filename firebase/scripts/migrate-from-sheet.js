// هجرة البيانات: يقرأ الـ 22 جدولاً من Google Sheet ويكتبها في Firestore (نفس أسماء الجداول كمجموعات).
// التشغيل (مرة واحدة، والكتابة في الشيت موقوفة):
//   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets.readonly,https://www.googleapis.com/auth/cloud-platform
//   GOOGLE_CLOUD_PROJECT=<project-id> node scripts/migrate-from-sheet.js [--dry] [--wipe]
'use strict';
process.env.TZ = 'Africa/Cairo';
const path = require('path');
const fnDir = path.join(__dirname, '../functions');
const admin = require(path.join(fnDir, 'node_modules/firebase-admin'));
const { GoogleAuth } = require(path.join(fnDir, 'node_modules/google-auth-library'));
const { createRuntime } = require(path.join(fnDir, 'runtime'));

const SHEET_ID = process.env.SHEET_ID || '1gvbF2BhoHMeektLSEFZFqFMWjUQPvEZuQsXdGuVJGiM';
const DRY = process.argv.includes('--dry');
const WIPE = process.argv.includes('--wipe');

(async () => {
  const rt = createRuntime();
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const client = await auth.getClient();
  const ranges = rt.TABLES.map(t => 'ranges=' + encodeURIComponent("'" + t + "'")).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const { data } = await client.request({ url });

  admin.initializeApp();
  const db = admin.firestore();
  let total = 0;
  for (let i = 0; i < rt.TABLES.length; i++) {
    const name = rt.TABLES[i];
    const values = (data.valueRanges[i] && data.valueRanges[i].values) || [];
    const headers = (values[0] || []).map(h => String(h).trim());
    const want = rt.HEADERS[name];
    const rows = values.slice(1).filter(r => r.some(v => v !== '' && v !== null));
    const docs = rows.map((r, idx) => {
      const o = { _ord: idx + 1 };
      want.forEach(h => {
        const c = headers.indexOf(h);
        let v = c === -1 ? '' : (r[c] === undefined ? '' : r[c]);
        if (v !== '' && /_ID$|Mobile|Phone|National_ID_Last4|Username|Receipt_No|_Ref|_Date$|_At$|Timestamp|DateTime/.test(h) && typeof v !== 'string') v = String(v);
        o[h] = v;
      });
      return o;
    });
    console.log(`${name}: ${docs.length} صف` + (headers.length && want.some(h => headers.indexOf(h) === -1) ? ' (أعمدة ناقصة في الشيت تُملأ فارغة)' : ''));
    total += docs.length;
    if (DRY) continue;
    const col = db.collection(name);
    if (WIPE) { const old = await col.listDocuments(); for (let k = 0; k < old.length; k += 400) { const b = db.batch(); old.slice(k, k + 400).forEach(d => b.delete(d)); await b.commit(); } }
    for (let k = 0; k < docs.length; k += 400) {
      const b = db.batch();
      docs.slice(k, k + 400).forEach(d => b.set(col.doc(), d));
      await b.commit();
    }
  }
  console.log((DRY ? '[تجربة] ' : '') + 'الإجمالي: ' + total + ' صف');
})().catch(e => { console.error(e); process.exit(1); });
