#!/usr/bin/env python3
"""Check all embedded question data and the audit's exact text-only changes."""
import pathlib,re,json,subprocess,itertools,collections,csv
root=pathlib.Path(__file__).resolve().parents[1]
summary=json.loads((root/'audit/summary.json').read_text());base=summary['baseCommit']
findings=json.loads((root/'audit/findings.json').read_text())
pattern=r'const QUESTIONS=(\[.*?\]);'
def extract(s):return json.loads(re.search(pattern,s,re.S)[1])
def strings(x,path=''):
 if isinstance(x,str):yield path,x
 elif isinstance(x,list):
  for i,v in enumerate(x):yield from strings(v,f'{path}[{i}]')
 elif isinstance(x,dict):
  for k,v in x.items():yield from strings(v,f'{path}.{k}' if path else k)
counts=collections.Counter();variants=[]
for file in ['index.html','stage1.html','all-lessons.html','level3.html']:
 source=(root/file).read_text();oldsource=subprocess.check_output(['git','show',f'{base}:{file}'],cwd=root,text=True)
 qs=extract(source);old=extract(oldsource)
 assert len(qs)==len(old)==100
 assert [q['id'] for q in qs]==[q['id'] for q in old]==list(range(1,101))
 assert re.sub(pattern,'DATA',source,flags=re.S)==re.sub(pattern,'DATA',oldsource,flags=re.S),f'{file}: runtime/UI changed'
 for q,b in zip(qs,old):
  counts['records']+=1
  assert q['a']==b['a'] and q['cat']==b['cat']
  assert len(q['o'])==len(b['o'])==4 and len(set(q['o']))==4
  assert type(q['a']) is int and 0<=q['a']<4
  assert q.keys()==b.keys()
  assert all(isinstance(q[k],str) and q[k].strip() for k in ['q','cat','e'])
  for path,value in strings(q):
   assert value.strip() and '\ufffd' not in value,(file,q['id'],path)
  before=dict(strings(b));after=dict(strings(q))
  for path,value in after.items():
   if before[path]!=value:
    rows=[r for r in findings if r['ファイル']==file and r['問題ID']==q['id'] and r['項目']==path and r['状態']=='自動修正済み']
    assert len(rows)==1 and rows[0]['修正前']==before[path] and rows[0]['修正案']==value,(file,q['id'],path)
    counts['changedFields']+=1
  lesson=q.get('lesson')
  if lesson:
   assert all(isinstance(lesson[k],str) and lesson[k].strip() for k in ['conclusion','basics','example','point'])
   assert len(lesson['wrong'])==4 and lesson['wrong'][q['a']] is None
   assert all(isinstance(v,str) and v.strip() for i,v in enumerate(lesson['wrong']) if i!=q['a'])
   counts['detailedLessons']+=1
  for perm in itertools.permutations(range(4)):
   assert sum(i==q['a'] for i in perm)==1
   if lesson:
    assert all(lesson['wrong'][i] for i in perm if i!=q['a'])
   counts['choicePermutations']+=1
  variants.append((file,q))
 # No exact question duplicates within each version.
 assert len({q['q']for q in qs})==100
for name in ['dashboard-date.js','level3-coach.js']:
 assert (root/name).read_bytes()==subprocess.check_output(['git','show',f'{base}:{name}'],cwd=root)
assert counts['changedFields']==summary['autoFixedFields']
coverage=list(csv.DictReader((root/'audit/coverage.csv').open(encoding='utf-8-sig')))
assert len(coverage)==400 and len({(r['ファイル'],r['問題ID'])for r in coverage})==400
assert len([r for r in findings if r['状態']=='自動修正済み'])==counts['changedFields']
result={'status':'PASS','checks':dict(counts),'limits':'構造・正解位置・選択肢と誤答解説の対応を検証。自然言語の技術的正誤・公式シラバスとの一致を証明するテストではない。'}
(root/'audit/data-test-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
