/* G検定プレビュー専用: 本人確認後の手動クラウド同期。デフォルト無通信・無送信。 */
(()=>{'use strict';
const API_URL='https://kuduxlkmuvongfdqyjoc.supabase.co';
const PUBLIC_KEY='sb_publishable_a2M9GVPbhf7xaTOnI3hH8Q_kXOKzIzy';
const OPT_IN='gkentei-preview-cloud-opt-in-v1';
const SESSION='gkentei-preview-cloud-session-v1';
const $c=id=>document.getElementById(id);
let session=null;
const status=(t,error=false)=>{const el=$c('cloudStatus');if(el){el.textContent=t;el.style.color=error?'#b42318':'#43556d'}};
const consent=()=>localStorage.getItem(OPT_IN)==='yes';
const headers=(token)=>({'apikey':PUBLIC_KEY,'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})});
async function call(path,{method='GET',body,token,extra={}}={}){
 const response=await fetch(API_URL+path,{method,headers:{...headers(token),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!response.ok){let message;try{const e=await response.json();message=e.msg||e.message||e.error_description||e.error}catch{}throw new Error(message||'HTTP '+response.status)}
 if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
}
function saveSession(s){session=s; if(s)sessionStorage.setItem(SESSION,JSON.stringify(s));else sessionStorage.removeItem(SESSION);render();}
function render(){
 const active=consent(),signed=!!session?.access_token;
 $c('cloudConsent').checked=active;
 $c('cloudLogin').hidden=signed;
 $c('cloudLoggedIn').hidden=!signed;
 $c('cloudSyncButton').disabled=!active||!signed;
 $c('cloudEmailLabel').textContent=signed?'認証済み（このブラウザ内のセッション）':'';
}
async function token(){
 if(!session?.access_token)throw new Error('先にメールでログインしてください。');
 if(session.expires_at && Date.now()/1000<session.expires_at-60)return session.access_token;
 if(!session.refresh_token)throw new Error('ログインの有効期限が切れました。再ログインしてください。');
 const s=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
 saveSession({...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)});
 return session.access_token;
}
async function approved(t){
 const rows=await call('/rest/v1/allowed_sync_users?select=user_id&limit=1',{token:t});
 if(!Array.isArray(rows)||rows.length===0)throw new Error('このアカウントはまだ同期許可リストに登録されていません。管理画面で本人を許可してからお試しください。');
}
async function eventUUID(row,index){
 const input=String(row.id)+'|'+String(row.at)+'|'+String(!!row.ok);
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)));
 const b=digest.slice(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
 const hex=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function makeBackup(){
 const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),local_storage_key:KEY,data},null,2)],{type:'application/json'});
 const anchor=document.createElement('a');anchor.href=globalThis.URL.createObjectURL(blob);anchor.download='gkentei-preview-backup-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>globalThis.URL.revokeObjectURL(anchor.href),1000);
}
async function getAllEvents(t){
 let output=[];let offset=0;
 while(true){
  const rows=await call('/rest/v1/answer_events?select=event_id,question_id,is_correct,answered_at&order=answered_at.asc&limit=1000&offset='+offset,{token:t});
  if(!Array.isArray(rows))throw new Error('サーバーの履歴取得に失敗しました。');
  output.push(...rows);if(rows.length<1000)break;offset+=1000;
  if(offset>100000)throw new Error('履歴件数が多いため安全のため処理を中断しました。');
 }
 return output;
}
async function manualSync(){
 if(!consent())return status('先にクラウド同期に同意してください。',true);
 const btn=$c('cloudSyncButton');btn.disabled=true;
 try{
  if(!Array.isArray(data.history))throw new Error('端末内の学習履歴を読み取れません。');
  const t=await token();await approved(t);
  const local=data.history.map(r=>({...r}));
  const remote=await getAllEvents(t);
  const known=new Set(remote.map(x=>x.event_id));
  const user=await call('/auth/v1/user',{token:t});
  if(!user?.id)throw new Error('認証ユーザーを確認できません。');
  const outgoing=[];
  for(let i=0;i<local.length;i++){
   const r=local[i];if(!r||!Number.isFinite(Number(r.id))||typeof r.ok!=='boolean'||!Number.isFinite(Date.parse(r.at)))continue;
   const eid=await eventUUID(r);
   if(!known.has(eid))outgoing.push({event_id:eid,user_id:user.id,question_id:String(r.id),is_correct:r.ok,answered_at:r.at});
  }
  if(!window.confirm('端末内の履歴 '+local.length+'件のうち、未登録の約'+outgoing.length+'件をクラウドへ送信します。既存の端末履歴は残し、他の端末で保存済みの記録も取り込みます。実行しますか？')){status('同期をキャンセルしました。');return}
  makeBackup();
  for(let i=0;i<outgoing.length;i+=200){
   await call('/rest/v1/answer_events?on_conflict=event_id',{method:'POST',body:outgoing.slice(i,i+200),token:t,extra:{Prefer:'resolution=ignore-duplicates,return=minimal'}});
  }
  const latest=await getAllEvents(t);
  const existing=new Set();
  const merged=[];
  // 同じ解答を識別できる限り保ち、端末内イベントを最優先して保持する
  for(let i=0;i<local.length;i++){
   const r=local[i];if(!r||typeof r.ok!=='boolean'||!Number.isFinite(Date.parse(r.at)))continue;
   const eid=await eventUUID(r);existing.add(eid);merged.push(r);
  }
  for(const r of latest){
   if(existing.has(r.event_id))continue;
   // 別端末の履歴。追加のみで端末側の既存履歴を上書きしない。
   merged.push({id:Number(r.question_id),ok:r.is_correct,at:r.answered_at});
  }
  merged.sort((a,b)=>new Date(a.at)-new Date(b.at));
  // wrongの整合性は、履歴から再構成する（過去の誤答を再生し最後の正解で消す）
  const wrong=new Set();
  for(const r of merged){if(r.ok)wrong.delete(r.id);else wrong.add(r.id)}
  const next={...data,history:merged,wrong:[...wrong]};
  localStorage.setItem(KEY,JSON.stringify(next));
  data=next;if(typeof dashboard==='function')dashboard();
  status('同期完了。サーバー '+latest.length+'件、端末内 '+merged.length+'件。JSONバックアップもダウンロードしました。');
 }catch(e){status('同期できませんでした：'+e.message+'。端末内の学習履歴は保持されています。',true)}
 finally{render()}
}
function init(){
 try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{session=null}
 // メールリンクから戻ってきた時のトークン。許可前にクラウド履歴を自動取得しない。
 const hash=new URLSearchParams(location.hash.replace(/^#/,''));const access=hash.get('access_token'),refresh=hash.get('refresh_token');
 if(access){
  saveSession({access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});
  history.replaceState(null,'',location.pathname+location.search);
  status('ログインできました。クラウド同期はまだ自動実行されません。');
 }
 $c('cloudConsent').addEventListener('change',e=>{
  if(e.target.checked){
   if(!confirm('問題ID・正誤・解答日時を、本人が「同期する」を押した場合だけSupabaseへ保存します。通常利用では送信しません。同意しますか？')){e.target.checked=false;return}
   localStorage.setItem(OPT_IN,'yes');status('同期が有効です。ただし「手動で同期する」を押すまで送信されません。');
  }else{localStorage.removeItem(OPT_IN);status('クラウド同期をオフにしました。既に送信したデータは自動削除されません。')}
  render();
 });
 $c('cloudPasswordLogin').addEventListener('click',async()=>{
  const email=$c('cloudEmail').value.trim();
  const password=$c('cloudPassword').value;
  if(!/^\S+@\S+\.\S+$/.test(email)||!password){status('メールアドレスとパスワードを入力してください。',true);return;}
  const button=$c('cloudPasswordLogin');button.disabled=true;
  try{
   const result=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   if(!result?.access_token||!result?.refresh_token)throw new Error('ログイン情報を取得できませんでした。');
   saveSession({...result,expires_at:Math.floor(Date.now()/1000)+(result.expires_in||3600)});
   $c('cloudPassword').value='';
   status('ログインに成功しました。同期はオフのままです。');
  }catch(e){status('ログインできませんでした。メールアドレスまたはパスワードを確認してください。',true);}
  finally{button.disabled=false;}
 });
 $c('cloudSignOut').addEventListener('click',async()=>{const t=session?.access_token;saveSession(null);if(t){try{await call('/auth/v1/logout',{method:'POST',token:t})}catch(_){}}status('ログアウトしました。端末の学習履歴は残っています。')});
 $c('cloudBackup').addEventListener('click',()=>{makeBackup();status('学習履歴のバックアップをダウンロードしました。')});
 $c('cloudSyncButton').addEventListener('click',manualSync);
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
