// فحص مكتبة رمز الاستلام: node qr.check.js
const qrcode = require('../web/js/vendor/qrcode.js');
const q = qrcode(0, 'M'); q.addData('WB:1001'); q.make();
const svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
if (!/^<svg/.test(svg) || svg.length < 500) { console.error('QR FAILED'); process.exit(1); }
console.log('QR OK', svg.length);
