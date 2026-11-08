// Same-origin, preview-only POST bridge. User JWT is forwarded unchanged;
// the database's existing RLS remains the final authorisation boundary.
const SUPABASE='https://kuduxlkmuvongfdqyjoc.supabase.co';
const PUBLIC_KEY='sb_publishable_a2M9GVPbhf7xaTOnI3hH8Q_kXOKzIzy';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const origin=req.headers.origin;
 const host=req.headers.host;
 if(origin && new URL(origin).host!==host)return res.status(403).json({error:'Cross-origin request rejected'});
 const auth=req.headers.authorization||'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return res.status(401).json({error:'Log in first'});
 try{
  const rows=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!Array.isArray(rows)||rows.length<1||rows.length>100)return res.status(400).json({error:'Invalid batch size'});
  if(!rows.every(r=>r && typeof r.event_id==='string' && /^[0-9a-f-]{36}$/i.test(r.event_id) && typeof r.user_id==='string' && /^[0-9a-f-]{36}$/i.test(r.user_id) && typeof r.question_id==='string' && /^\d{1,3}$/.test(r.question_id) && typeof r.is_correct==='boolean' && typeof r.answered_at==='string' && Number.isFinite(Date.parse(r.answered_at))))
   return res.status(400).json({error:'Invalid answer data'});
  const upstream=await fetch(SUPABASE+'/rest/v1/answer_events?on_conflict=event_id',{
   method:'POST',
   headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify(rows),
   signal:AbortSignal.timeout(12000)
  });
  if(!upstream.ok){
   const body=(await upstream.text()).slice(0,800);
   // Avoid echoing untrusted upstream internals to browser.
   return res.status(upstream.status===401||upstream.status===403?upstream.status:502).json({error:'Database write rejected',status:upstream.status,detail:upstream.status===401||upstream.status===403?'Not authorised':undefined});
  }
  return res.status(200).json({ok:true,batch:rows.length});
 }catch(e){return res.status(502).json({error:'Upload bridge unavailable'});}
}
