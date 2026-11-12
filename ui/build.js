// يبني أصول الواجهة: أيقونات Lucide المستخدمة فقط + الخطوط + أيقونات التطبيق + CSS (Tailwind)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const WEB = path.join(__dirname, '..', 'web');
const ICONS = 'book-open library house shopping-bag receipt wallet user log-out search plus minus trash-2 check check-check x chevron-left chevron-down chevron-right layout-dashboard library-big calendar-range users clipboard-list truck list-ordered package-check banknote landmark chart-column settings store printer download refresh-cw triangle-alert info clock sparkles badge-percent credit-card smartphone hand-coins calendar-check key-round menu layout-grid arrow-left-right undo-2 ban play send file-text filter building-2 graduation-cap piggy-bank circle-check circle-alert hourglass lock upload package boxes scale coins chart-pie trending-up list-checks shield-check eye eye-off sliders-horizontal circle-x arrow-right wand-sparkles book-marked calendar-clock badge-check user-cog file-spreadsheet clipboard-check notebook-pen pencil activity database shopping-cart history bell headset phone message-circle mail megaphone'.split(' ');

const map = {};
for (const n of ICONS) {
  const svg = fs.readFileSync(path.join(__dirname, 'node_modules/lucide-static/icons', n + '.svg'), 'utf8');
  map[n] = svg.replace(/<!--[\s\S]*?-->/, '').replace(/<svg[\s\S]*?>/, '').replace(/<\/svg>/, '').replace(/\s*\n\s*/g, '');
}
fs.mkdirSync(path.join(WEB, 'js'), { recursive: true });
fs.writeFileSync(path.join(WEB, 'js', 'icons.js'), '/* Lucide icons (ISC) */\nwindow.ICONS=' + JSON.stringify(map) + ';\n');

// الخطوط (عربي + لاتيني للأرقام)
const fdir = path.join(WEB, 'fonts'); fs.mkdirSync(fdir, { recursive: true });
for (const w of [400, 500, 600, 700]) for (const sub of ['arabic', 'latin']) {
  const f = `ibm-plex-sans-arabic-${sub}-${w}-normal.woff2`;
  fs.copyFileSync(path.join(__dirname, 'node_modules/@fontsource/ibm-plex-sans-arabic/files', f), path.join(fdir, f));
}

// خط النص: Readex Pro (عربي حديث واضح على كل الشاشات)
for (const w of [400, 500, 600, 700]) for (const sub of ['arabic', 'latin']) {
  const f = `readex-pro-${sub}-${w}-normal.woff2`;
  fs.copyFileSync(path.join(__dirname, 'node_modules/@fontsource/readex-pro/files', f), path.join(fdir, f));
}
// خط العناوين: Alexandria (عربي حديث أنيق)
for (const w of [600, 700, 800]) for (const sub of ['arabic', 'latin']) {
  const f = `alexandria-${sub}-${w}-normal.woff2`;
  fs.copyFileSync(path.join(__dirname, 'node_modules/@fontsource/alexandria/files', f), path.join(fdir, f));
}

execSync(`npx tailwindcss -c tailwind.config.js -i src.css -o ${path.join(WEB, 'app.css')} --minify`, { cwd: __dirname, stdio: 'inherit' });
console.log('built icons:', ICONS.length);
