import json,re,pathlib,csv,subprocess,collections
ROOT=pathlib.Path('.'); BASE='cc86fd5580b2bcfebc9fda3dc936d91ac253993b'
files=['index.html','stage1.html','all-lessons.html','level3.html']; findings=[]; originals={}; current={}
def extract(s):return json.loads(re.search(r'const QUESTIONS=(\[.*?\]);',s,re.S)[1])
def row(f,q,field,before,after,why,severity='低',status='自動修正済み',kind='日本語表現'):
 findings.append(dict(ファイル=f,問題ID=q,項目=field,問題点=why,修正前=before,修正案=after,修正理由=why,重要度=severity,状態=status,分類=kind))
repls=[
 ('モデルが一度高精度ならすべてのOODでも同じ性能になる','モデルが一度高い精度を達成すれば、すべてのOODでも同じ性能を維持できる','「一度高精度なら」の省略を補い、誤答の主張を明確にする'),
 ('後者は近年の深層学習の応用。','他の三つの選択肢は近年の深層学習の応用。','四つの選択肢に対する「後者」の指示対象が不明確'),
 ('損失関数の勾配を利用した学習率が過大な場合の典型的な問題はどれか。','勾配降下法で学習率が過大な場合の典型的な問題はどれか。','「勾配を利用した学習率」という不自然な修飾関係を解消'),
 ('正答率','正解率','問題データ内のaccuracyの日本語表記を「正解率」に統一'),
 ('出力の縦横サイズは？','出力の縦横のサイズはどれか。','設問の文末を「どれか。」に統一'),
 ('その行動を選ぶ確率は？','その行動を選ぶ確率はどれか。','設問の文末を「どれか。」に統一'),
 ('陽性だった人が実際に有病である確率に最も近いのは？','陽性だった人が実際に有病である確率に最も近い値はどれか。','文末の省略を補い、数値を選ぶ設問と明示'),
 ('この値の標準化得点（z値）は？','この値の標準化得点（z値）はどれか。','設問の文末を「どれか。」に統一'),
 ('Y=2X+3の分散は？','Y=2X+3の分散はどれか。','設問の文末を「どれか。」に統一'),
 ('損失はどうなる？','損失はどうなるか。','設問の文末を常体に統一'),
 ('両方起こる確率は？','両方起こる確率はどれか。','設問の文末を「どれか。」に統一'),
]
def edit(v,f,q,path=''):
 if isinstance(v,str):
  for old,new,why in repls:
   if old in v:
    after=v.replace(old,new);row(f,q,path,v,after,why);v=after
  return v
 if isinstance(v,list):return [edit(t,f,q,f'{path}[{n}]') for n,t in enumerate(v)]
 if isinstance(v,dict):return {k:edit(t,f,q,f'{path}.{k}' if path else k) for k,t in v.items()}
 return v
for f in files:
 s=subprocess.check_output(['git','show',f'{BASE}:{f}'],text=True);a=extract(s);originals[f]=a;b=[edit(q,f,q['id']) for q in a];current[f]=b
 # Preserve all non-data source text and original per-record JSON style.
 for old,new in zip(a,b):
  if old!=new:
   oldtext=json.dumps(old,ensure_ascii=False,separators=(',',':'))
   newtext=json.dumps(new,ensure_ascii=False,separators=(',',':'))
   assert oldtext in s,(f,old['id'])
   s=s.replace(oldtext,newtext,1)
 pathlib.Path(f).write_text(s)
# Deliberately unmodified: subject-matter or question-design decisions.
reviews=[
 (12,'e','TP/(TP+FN)','TP（真陽性）は正しく陽性と判定した数、FN（偽陰性）は陽性を見逃した数。再現率は40/(40+10)=0.8。','短い解説だけではTP・FNの意味が示されず、初学者が分母の意味を理解しにくい。詳細解説のない版では用語の補足を検討する。','中'),
 (13,'e','TP/(TP+FP)','TPは真陽性、FPは偽陽性、FNは偽陰性、TNは真陰性。適合率の分母は陽性と予測した件数TP+FP。','短い解説だけでは略語の意味と分母の違いを説明できていない。詳細解説のない版では補足を検討する。','中'),
 (5,'q/o[1]','各辺のコストが等しいとき','各辺のコストが等しい正の値で、各ノードの子の数が有限である探索木を前提とする。','最短経路保証の前提が問題文では省略されている。負コスト等まで一般化しない条件を確認する。','中'),
 (16,'o[3]','予測対象時点より前のデータで評価する','過去の各評価時点について、その時点より前のデータだけで学習したモデルを評価する','「評価するデータが過去」だけではリークを防げず、訓練期間との前後関係が曖昧。複数誤答の読み方を避けたい。','高'),
 (27,'lesson.basics','一般的な設定では推論時は無効化せず','一般的な設定では推論時にDropout処理を停止し、全ユニットの出力を利用する。inverted dropoutでは訓練時に尺度を調整する。','無効化の対象がユニットかDropout処理か不明で、短い解説「推論時は無効化する」と矛盾して読める。スケーリング方式も技術確認後に明記する。','高'),
 (32,'e/lesson.conclusion','フィルタぶん縦横が縮む','この条件では縦横それぞれ5−3+1=3となり、入力より2画素小さくなる。','「フィルタぶん」は3画素減るようにも読める。式と減少量を区別する。','中'),
 (46,'lesson.intuition','合計が指定割合になるまで','累積確率が指定割合以上になるまで、確率の高い順に候補を残す。','直感説明では閾値を超える場合の扱いが省略される。本文の最小集合の定義とそろえる。','低'),
 (56,'o[1]','次状態での最大行動価値を目標に用いる','即時報酬と割引した次状態の最大行動価値を足した値を学習目標に用いる。','現選択肢も「用いる」なので誤りとは断定しないが、目標全体が最大Q値だけと誤解されないよう補う。','中'),
 (65,'q','相関係数','ピアソンの相関係数（各変数の分散は有限かつ正とする）','線形の関連を測る係数を明示したい。他の相関係数まで含む読み方と定義不能な条件を避ける。','中'),
 (73,'lesson.example','全体の平均15','訓練・検証の件数が等しく、訓練平均10・検証平均20なら、全体平均は15になる。','全体平均15という具体例は件数が等しい前提を省略している。','中'),
 (83,'q/e','個人情報の第三者提供','個人情報取扱事業者が扱う個人データの第三者提供について問う。解説は個人データと個人情報の定義を分ける。','indexとstage1には個人情報と個人データの混同が残る。法的な適用範囲を変えるため自動修正しない。','高'),
 (95,'q','AUCが0.5に近い','ROC-AUCが0.5に近い（正例ほどスコアが高い定義）','indexのAUCはROC-AUCかPR-AUCか不明。異なる指標を同一視しない。','高'),
 (61,'e','足し算0.7は和事象の単純な場合と混同','0.7は共通部分を引かずに足した値で、和事象は0.3+0.4−0.12=0.58、積事象は0.12。','indexの「単純な場合」は排反と独立を混同させ得る。条件と数値を示す修正は技術確認に回す。','中'),
 (66,'q','母集団からの独立同分布','平均が存在し、有限かつ正の分散を持つ独立同分布の標本','indexでは有限分散等が解説にしかなく、設問単体では中心極限定理が成立しない分布まで含む。','高'),
 (21,'o[1]','入力が負なら0、正なら入力をそのまま返す','入力が0以下なら0、正なら入力をそのまま返す','indexの選択肢は入力0を省略。現正解が誤りとはしないが全域の定義を示したい。','低'),
]
for f,a in originals.items():
 for q in a:
  for ident,field,needle,proposal,why,sev in reviews:
   if q['id']==ident and needle in json.dumps(q,ensure_ascii=False) and not (ident in [12,13] and 'lesson' in q):
    row(f,ident,field,json.dumps(q if field=='q/e' else {k:v for k,v in q.items() if k in field.split('/') or k in ['q','o','e','lesson']},ensure_ascii=False),proposal,why,sev,'要確認','技術・解説')
# Specific distractor defects; report concrete examples rather than rewriting answer sets.
weak={
 4:('重みを勾配降下法で更新する必要が必ずある','専門知識をルール化できれば、例外への対応や保守の負担は小さい'),
 10:('教師なし学習を行うモデルの正式名称','異なる知的課題へ転用するには、課題ごとの専用モデルを必ず作り直す概念'),
 29:('全パラメータが必ずゼロになること','訓練損失が十分小さくなったことだけを停止条件にする'),
 49:('学習パラメータ数が増えれば誤答は必ずゼロになる','モデルの出力が毎回一致するかだけを検証し、根拠資料との照合を省く'),
 60:('モデルのパラメータ数を自動的にゼロにする','人間の選好を、回答が事実であることを保証する教師信号として用いる'),
 98:('シャノンエントロピーだけ','ユークリッドノルムの差の絶対値'),
}
for f,a in originals.items():
 for q in a:
  if q['id'] in weak:
   old,new=weak[q['id']]
   if old in q['o']:row(f,q['id'],'o',old,new,'専門概念を知らなくても極端な断定や無関係な分野だけで消去できる。提案も一意性と難易度をレビューしてから採用する。','中','要確認','設問品質')
# Related-topic concentration: not exact duplicates, keep every ID.
for ids,why in [([47,48],'RAGの定義を繰り返す。片方を更新頻度・権限・検索漏れを問う事例問題にする。'),([75,96],'特徴量寄与と因果の区別が重なる。片方を相関特徴による重要度分散の事例にする。'),([72,77,100],'分布変化と運用対策が重なる。ドリフト・OOD・性能低下を区別する事例へ配分を検討する。')]:
 for ident in ids:row('全版',ident,'主題',why,'問題を削除せず、学習目標を分けた改題案を承認後に作成する。','完全一致の重複ではないが、100問内の出題範囲に対する重複度を確認する。','低','要確認','分布・重複')
# Source claims are inherited, not newly verified.
for f,a in originals.items():
 for q in a:
  if q.get('legal'):row(f,q['id'],'legal.verification',q['legal']['verification'],'元の照合記録を確認し、施行版・条文・文化庁資料を一次資料で再照合する。','既存データの確認済みという記載は今回再検証できていない。通信制限下で新しい確認済み日付に更新しない。','高','要確認','法令根拠')
fields=list(findings[0])
with open('audit/findings.csv','w',encoding='utf-8-sig',newline='') as h:
 w=csv.DictWriter(h,fields);w.writeheader();w.writerows(findings)
pathlib.Path('audit/findings.json').write_text(json.dumps(findings,ensure_ascii=False,indent=2))
coverage=[]
for f,a in originals.items():
 for q in a:
  rows=[r for r in findings if r['問題ID']==q['id'] and r['ファイル'] in [f,'全版']]
  coverage.append(dict(ファイル=f,問題ID=q['id'],分野=q['cat'],問題文='確認済み',選択肢='確認済み',正解='意味を確認・変更なし',解説='確認済み',詳細解説='確認済み' if 'lesson'in q else '未収録',シラバス='一次資料との照合保留',指摘数=len(rows),自動修正=any(r['状態']=='自動修正済み' for r in rows),要確認=any(r['状態']=='要確認'for r in rows)))
with open('audit/coverage.csv','w',encoding='utf-8-sig',newline='') as h:
 w=csv.DictWriter(h,list(coverage[0]));w.writeheader();w.writerows(coverage)
summary={'baseCommit':BASE,'branch':'audit/question-quality-20261107','uniqueQuestionIds':100,'dataRecords':400,'checkedRecords':len(coverage),'questionVariants':len({json.dumps({k:q[k]for k in ['q','o','a','e']},ensure_ascii=False,sort_keys=True)for a in originals.values()for q in a}),'affectedIds':len({r['問題ID']for r in findings}),'affectedRecords':sum(r['指摘数']>0 for r in coverage),'autoFixedIds':len({r['問題ID']for r in findings if r['状態']=='自動修正済み'}),'autoFixedRecords':sum(r['自動修正']for r in coverage),'autoFixedFields':sum(r['状態']=='自動修正済み'for r in findings),'reviewIds':len({r['問題ID']for r in findings if r['状態']=='要確認'}),'reviewRecords':sum(r['要確認']for r in coverage),'reviewFindings':sum(r['状態']=='要確認'for r in findings),'categories':dict(collections.Counter(q['cat'] for q in originals['level3.html']))}
pathlib.Path('audit/summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False,indent=2))
