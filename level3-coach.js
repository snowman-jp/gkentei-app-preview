/* Device-only recommendation and compatibility helpers. No network or storage IO. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReviewCoach=api})(globalThis,function(){
'use strict';
const DAY=86400000;
const WEIGHTS=Object.freeze({lastWrong:100,legacyReview:90,wrongEach:20,wrongCap:5,due:60,overdueCap:30,ageCap:60,ageEach:0.5,unseen:35});
const INTERVALS=Object.freeze([3,7,14,30]);
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const [year,month,day,hour,minute,second]=value.slice(0,19).split(/[-T:]/).map(Number);const calendar=new Date(Date.UTC(year,month-1,day));
 if(year<1000||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
 const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;
}
function localDayNumber(ms){const d=new Date(ms);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY}
function dayKey(ms){const d=new Date(ms);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function intervalDays(correct,streak){return correct?INTERVALS[Math.min(Math.max(streak,1),4)-1]:1}
function nextReview(at,correct,streak){const ms=timestamp(at);if(ms===null)return null;const d=new Date(ms);d.setDate(d.getDate()+intervalDays(correct,streak));return d.toISOString()}
function hash(text){let n=2166136261;for(let i=0;i<text.length;i++){n^=text.charCodeAt(i);n=Math.imul(n,16777619)}n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);return (n^(n>>>16))>>>0}
function normalize(value,ids){
 const valid=new Set(ids);const issues=[];const object=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 if(object!==value&&value!==null&&value!==undefined)issues.push('保存データの形式が通常と異なります。');
 const source=Array.isArray(object.history)?object.history:[];
 if(object.history!==undefined&&!Array.isArray(object.history))issues.push('履歴の形式を読み取れませんでした。');
 const history=source.filter(r=>r&&typeof r==='object'&&!Array.isArray(r)&&valid.has(r.id)&&typeof r.ok==='boolean').map(r=>({...r}));
 if(history.length!==source.length)issues.push('一部の記録は集計できませんでした。');
 const originalWrong=Array.isArray(object.wrong)?object.wrong:[];
 if(object.wrong!==undefined&&!Array.isArray(object.wrong))issues.push('復習リストの形式を読み取れませんでした。');
 const wrong=[...new Set(originalWrong.filter(id=>valid.has(id)))];
 if(wrong.length!==originalWrong.length)issues.push('復習リストに重複または現在扱えない問題IDがあります。');
 const sets=Number.isSafeInteger(object.sets)&&object.sets>=0?object.sets:0;
 if(object.sets!==undefined&&sets!==object.sets)issues.push('セット数を読み取れませんでした。');
 // Keep the legacy review list. New answers update it through the existing app flow.
 const data={...object,history,wrong,sets,schemaVersion:2};
 return {data,issues,requiresBackup:issues.length>0,readOnly:Number.isInteger(object.schemaVersion)&&object.schemaVersion>2};
}
function parse(raw,ids){
 if(raw===null||raw===undefined)return normalize(null,ids);
 try{return normalize(JSON.parse(raw),ids)}catch(_){const result=normalize(null,ids);result.issues=['保存データを読み取れませんでした。元データを保持して学習を続けます。'];result.requiresBackup=true;return result}
}
function statistics(data,ids){
 const result={};const legacy=new Set(data.wrong||[]);
 for(const id of ids)result[id]={totalAttempts:0,correctCount:0,wrongCount:0,lastCorrect:null,correctStreak:0,lastAnsweredAt:null,nextReviewAt:null,recentResults:[],legacyReview:legacy.has(id)};
 for(const row of data.history){const s=result[row.id];if(!s)continue;s.totalAttempts++;row.ok?s.correctCount++:s.wrongCount++;s.lastCorrect=row.ok;s.correctStreak=row.ok?s.correctStreak+1:0;s.lastAnsweredAt=timestamp(row.at)!==null?row.at:null;s.nextReviewAt=nextReview(s.lastAnsweredAt,row.ok,s.correctStreak);s.recentResults.push(row.ok);if(s.recentResults.length>3)s.recentResults.shift();s.legacyReview=false}
 return result;
}
function fingerprint(data){return String(hash(JSON.stringify([data.history.map(r=>[r.id,r.ok,r.at??null]),[...data.wrong].sort((a,b)=>a-b)])))}
function rankQuestion(question,s,now,seed){
 const day=localDayNumber(now),last=timestamp(s.lastAnsweredAt),next=timestamp(s.nextReviewAt);
 const age=last!==null?Math.max(0,day-localDayNumber(last)):null;
 const due=next!==null&&localDayNumber(next)<=day;
 const overdue=due?Math.max(0,day-localDayNumber(next)):0;
 const unseen=s.totalAttempts===0&&!s.legacyReview;
 const repeatMistakes=s.wrongCount>=2&&s.correctStreak<2;
 const reviewCandidate=s.lastCorrect===false||s.legacyReview||due||repeatMistakes||(age!==null&&age>=14&&s.correctStreak<2);
 const score=(s.lastCorrect===false?WEIGHTS.lastWrong:0)+(s.legacyReview?WEIGHTS.legacyReview:0)+Math.min(s.wrongCount,WEIGHTS.wrongCap)*WEIGHTS.wrongEach/(1+s.correctStreak)+(due?WEIGHTS.due+Math.min(overdue,WEIGHTS.overdueCap):0)+(age!==null?Math.min(age,WEIGHTS.ageCap)*WEIGHTS.ageEach:0)+(unseen?WEIGHTS.unseen:0);
 const recentWrong=s.recentResults.filter(x=>!x).length;
 let reason;
 if(s.lastCorrect===false)reason='前回不正解だったため';
 else if(s.legacyReview)reason='復習対象として保存されているため（回答記録は不明）';
 else if(repeatMistakes&&recentWrong>=2)reason=`直近${s.recentResults.length}回のうち${recentWrong}回不正解のため`;
 else if(due)reason=`前回の${s.lastCorrect?'正解':'回答'}から${age}日。復習の目安日を迎えたため`;
 else if(repeatMistakes)reason=`全${s.totalAttempts}回の解答で${s.wrongCount}回不正解のため`;
 else if(reviewCandidate&&age!==null&&age>=14)reason=`最後の回答から${age}日経過したため`;
 else if(unseen)reason='読み取れる解答記録がないため';
 else if(last===null)reason='回答日時が不明なため、復習候補として補充';
 else reason='次の復習日前ですが、5問をそろえるために補充';
 return {id:question.id,score,priority:score>=100?'高':score>=40?'中':'低',reason,reviewCandidate,due,unseen,tie:hash(seed+'|'+question.id)};
}
function recommend(questions,data,now=Date.now()){
 if(!Number.isFinite(now))throw new TypeError('有効な現在時刻が必要です');
 const unique=[...new Map(questions.map(q=>[q.id,q])).values()];const stats=statistics(data,unique.map(q=>q.id));const seed=dayKey(now)+'|'+fingerprint(data);
 const ranked=unique.map(q=>rankQuestion(q,stats[q.id],now,seed)).sort((a,b)=>b.score-a.score||a.tie-b.tie||a.id-b.id);
 const ordered=[...ranked.filter(x=>x.reviewCandidate),...ranked.filter(x=>!x.reviewCandidate&&x.unseen),...ranked.filter(x=>!x.reviewCandidate&&!x.unseen)];
 return {items:ordered.slice(0,5),stats,day:dayKey(now),reviewCount:ranked.filter(x=>x.reviewCandidate).length,dueCount:ranked.filter(x=>x.due).length,total:unique.length};
}
return Object.freeze({WEIGHTS,INTERVALS,timestamp,dayKey,intervalDays,nextReview,normalize,parse,statistics,fingerprint,rankQuestion,recommend});
});
