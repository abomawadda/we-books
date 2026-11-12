# يحوّل شيت الكتب (الصف، النوع، الكتاب/الناشر، المادة) إلى كتالوج منظم بأكواد جديدة: python3 build_catalog.py Books.xlsx
import openpyxl, json, collections, re
ws=openpyxl.load_workbook(__import__('sys').argv[1],data_only=True).active
rows=[r for r in ws.iter_rows(min_row=2,values_only=True) if any(r)]
GRADES=[("TAS","تأسيس","رياض الأطفال"),("KG1","كي جي 1","رياض الأطفال"),("KG2","كي جي 2","رياض الأطفال")]+\
 [(f"P{i}",f"{i} ابتدائي","المرحلة الابتدائية") for i in range(1,7)]+[(f"M{i}",f"{i} إعدادي","المرحلة الإعدادية") for i in range(1,4)]+[(f"S{i}",f"{i} ثانوي","المرحلة الثانوية") for i in range(1,4)]
G={g[1]:g for g in GRADES}
SPECIAL={'إنجليزي بلاس':('إنجليزي','بلاس'),'إنجليزي - أوليف':('إنجليزي','أوليف'),'مستوى رفيع':('إنجليزي','مستوى رفيع'),
         'جرامر':('إنجليزي','جرامر'),'النحو':('نحو','')}
def norm(sub):
    sub=sub.strip()
    if sub in SPECIAL: return SPECIAL[sub]
    part=''
    for p in ['شرح','أسئلة','تدريبات']:
        if sub.endswith(' '+p): sub=sub[:-len(p)-1].strip(); part=p
    if sub.endswith(' لغات'): sub=sub[:-5].strip()
    return sub,part
LANG_SHARED={'عربي','دين','دراسات','تاريخ','جغرافيا','فلسفة ومنطق','علم نفس','نحو','بلاغة'}
RELIGIOUS={'دين','فقه شافعي','تفسير','حديث','توحيد','أصول دين'}
SUBJ_ORDER=['عربي','نحو','نحو وصرف','بلاغة','إنجليزي','فرنساوي','ألماني','رياضيات','ماث','رياضيات بحتة','رياضيات تطبيقية','رياضيات أدبي','إحصاء',
 'علوم','ساينس','علوم متكاملة','فيزياء','كيمياء','أحياء','دراسات','تاريخ','جغرافيا','فلسفة ومنطق','علم نفس','دين','فقه شافعي','تفسير','حديث','توحيد','أصول دين',
 'حاسب آلي','أي سي تي','تكنولوجيا','ديسكفري','مهارات']
PART_ORDER=['','شرح','أسئلة','تدريبات','بلاس','جرامر','مستوى رفيع','أوليف']
items=[]
for r in rows:
    grade=str(r[2]).strip(); typ=(r[3] or '').strip() or 'حكومي'; pub=str(r[4]).strip()
    sub,part=norm(str(r[5]))
    types=[typ]
    if typ=='حكومي':
        if sub in LANG_SHARED: types.append('لغات')
        if sub not in RELIGIOUS: types.append('أزهر')
    items.append(dict(grade=grade,types=types,pub=pub,sub=sub,part=part,orig=str(r[5]).strip(),old=r[1]))
miss=[s for s in {i['sub'] for i in items} if s not in SUBJ_ORDER]; assert not miss, miss
assert all(i['grade'] in G for i in items)
items.sort(key=lambda i:(GRADES.index(G[i['grade']]),SUBJ_ORDER.index(i['sub']),PART_ORDER.index(i['part']),i['pub']))
cnt=collections.Counter(); out=[]
for i in items:
    gc,gl,st=G[i['grade']]; cnt[gc]+=1
    code=f"{gc}-{cnt[gc]:03d}"
    out.append([code,gl,st,'،'.join(i['types']),i['pub'],i['sub'],i['part']])
    i['code']=code
# uniqueness of (grade,pub,sub,part)
dup=[k for k,v in collections.Counter((o[1],o[4],o[5],o[6]) for o in out).items() if v>1]
print('rows',len(out),'dups',dup)
print('types',collections.Counter(o[3] for o in out))
pubs=sorted({o[4] for o in out}); subs=[s for s in SUBJ_ORDER if s in {o[5] for o in out}]; parts=[p for p in PART_ORDER if p and p in {o[6] for o in out}]
print(len(pubs),len(subs),parts)
json.dump({'books':out,'pubs':pubs,'subs':subs,'parts':parts},open('catalog.json','w'),ensure_ascii=False)
json.dump(items,open('catalog_map.json','w'),ensure_ascii=False)
print(out[:3], out[-2:])
