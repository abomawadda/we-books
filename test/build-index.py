# يبني Index.html من Index.src.html: يُغلَّف كود الواجهة بترميز Base64 حتى لا يعدّله خادم Google
import re, base64, sys
VERSION = sys.argv[1] if len(sys.argv) > 1 else "2.0.4"
src = open('apps-script/Index.src.html', encoding='utf-8').read()
m = list(re.finditer(r'<script>(.*?)</script>', src, re.S))[-1]
code = m.group(1)
b64 = base64.b64encode(code.encode('utf-8')).decode('ascii')
loader = ('<script>window.addEventListener("error",function(ev){var d=document.createElement("div");d.style.cssText="background:#fee;color:#900;padding:10px;font:14px Tahoma;direction:rtl";d.textContent="خطأ في الواجهة: "+(ev.message||ev.error);document.body.insertBefore(d,document.body.firstChild);});(function(){try{var c=decodeURIComponent(escape(atob("' + b64 + '")));'
          'var s=document.createElement("script");s.text=c;document.body.appendChild(s);}'
          'catch(e){document.body.insertAdjacentHTML("afterbegin","<div style=\\"background:#fee;padding:12px;font:16px Tahoma\\">خطأ تحميل الواجهة: "+e.message+"</div>");}})();</script>')
out = src[:m.start()] + loader + src[m.end():]
out = out.replace('التوزيع بالأسبقية · التحصيل · التصفية</small>', 'التوزيع بالأسبقية · التحصيل · التصفية · v' + VERSION + '</small>')
open('apps-script/Index.html', 'w', encoding='utf-8').write(out)
print("built", len(out), "bytes; version", VERSION)
