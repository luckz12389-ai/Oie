(function(){
const cfg=window.LUNEX_CONFIG||{};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),3200)};

/* ---------- Estrelas (efeito de velocidade) ---------- */
(function(){
  const c=$('#stars'),x=c.getContext('2d');let W,H,S=[];
  const rs=()=>{W=c.width=innerWidth;H=c.height=innerHeight;S=Array.from({length:140},()=>({a:Math.random()*6.283,r:Math.random()*Math.max(W,H)/2,v:.3+Math.random()*1.2}))};
  rs();addEventListener('resize',rs);
  (function f(){
    x.fillStyle='rgba(10,0,20,.35)';x.fillRect(0,0,W,H);
    for(const s of S){
      const px=W/2+Math.cos(s.a)*s.r,py=H/2+Math.sin(s.a)*s.r;
      s.r+=s.v*(1+s.r/220);
      const qx=W/2+Math.cos(s.a)*(s.r+s.v*4),qy=H/2+Math.sin(s.a)*(s.r+s.v*4);
      x.strokeStyle='rgba(216,180,254,'+Math.min(1,s.r/300)+')';x.lineWidth=1.3;
      x.beginPath();x.moveTo(px,py);x.lineTo(qx,qy);x.stroke();
      if(s.r>Math.max(W,H)*.75){s.r=Math.random()*40;s.a=Math.random()*6.283}
    }
    requestAnimationFrame(f);
  })();
})();

/* ---------- Efeito de clique ---------- */
addEventListener('pointerdown',e=>{
  const fx=$('#fx'),r=document.createElement('div');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';fx.appendChild(r);setTimeout(()=>r.remove(),700);
  for(let i=0;i<7;i++){const s=document.createElement('div');s.className='spark';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';
    const a=Math.random()*6.283,d=30+Math.random()*40;s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');fx.appendChild(s);setTimeout(()=>s.remove(),700)}
});

/* ---------- Supabase ---------- */
const ok=cfg.SUPABASE_URL&&cfg.SUPABASE_URL.startsWith('http')&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes('COLE_AQUI');
if(!ok){$('#cfgwarn').classList.remove('hidden');return}
const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let me=null;

$$('.oauth').forEach(b=>b.onclick=async()=>{
  const {error}=await sb.auth.signInWithOAuth({provider:b.dataset.p,options:{redirectTo:location.origin+location.pathname}});
  if(error)toast('Erro: '+error.message);
});
$('#logout').onclick=async()=>{await sb.auth.signOut();location.reload()};

/* ---------- Abas ---------- */
function openTab(t){
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  $$('.page').forEach(p=>p.classList.toggle('active',p.id==='p-'+t));
  if(t==='logs'||t==='game')loadPosts(t);
  if(t==='admin')loadCodes();
}
$$('.tab').forEach(b=>b.onclick=()=>openTab(b.dataset.tab));

/* ---------- Sessão ---------- */
async function loadMe(session){
  const u=session.user;
  let {data}=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle();
  if(!data){await new Promise(r=>setTimeout(r,800));({data}=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle())}
  me=data||{id:u.id,name:u.user_metadata?.full_name||u.user_metadata?.user_name||'User',avatar:u.user_metadata?.avatar_url,role:'user'};
  $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#uName').textContent=me.name||'User';
  $('#uAvatar').src=me.avatar||'assets/lunex-moon.png';
  const rb=$('#uRole');rb.textContent=me.role==='user'?'Membro':me.role==='admin'?'Admin':'Owner';rb.className='badge '+me.role;
  $('#tabAdmin').classList.toggle('hidden',me.role!=='owner');
  buildComposer('logs',['admin','owner'].includes(me.role));
  buildComposer('game',me.role==='owner');
  $('.redeem').classList.toggle('hidden',me.role!=='user');
}
sb.auth.onAuthStateChange((_e,s)=>{if(s&&!me)setTimeout(()=>loadMe(s),0)});
sb.auth.getSession().then(({data})=>{if(data.session)loadMe(data.session)});

/* ---------- Resgatar código ---------- */
$('#redeemBtn').onclick=async()=>{
  const c=$('#codeIn').value.trim().toUpperCase();if(!c)return;
  const {error}=await sb.rpc('redeem_code',{c});
  if(error){$('#redeemMsg').textContent='Código inválido ou já usado.';return}
  toast('Você agora é Admin! 🎉');setTimeout(()=>location.reload(),900);
};

/* ---------- Postagens ---------- */
function buildComposer(sec,can){
  const box=$('#composer-'+sec);
  if(!can){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  box.innerHTML=`<h3>${sec==='logs'?'Nova atualização':'Nova postagem do Game'}</h3>
   <input id="t-${sec}" placeholder="Título" maxlength="120">
   <textarea id="b-${sec}" placeholder="Escreva aqui..."></textarea>
   <img id="pv-${sec}" class="preview hidden">
   <div class="row"><label class="btn ghost" style="cursor:pointer">📷 Imagem<input id="f-${sec}" type="file" accept="image/*" hidden></label>
   <button class="btn" id="s-${sec}">Publicar</button></div>`;
  $('#f-'+sec).onchange=e=>{const f=e.target.files[0];const pv=$('#pv-'+sec);if(!f){pv.classList.add('hidden');return}pv.src=URL.createObjectURL(f);pv.classList.remove('hidden')};
  $('#s-'+sec).onclick=()=>publish(sec);
}
async function publish(sec){
  const title=$('#t-'+sec).value.trim(),body=$('#b-'+sec).value.trim(),file=$('#f-'+sec).files[0];
  if(!title){toast('Coloque um título');return}
  const btn=$('#s-'+sec);btn.disabled=true;btn.textContent='Enviando...';
  try{
    let image_url=null;
    if(file){
      const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path=`${me.id}/${Date.now()}.${ext}`;
      const up=await sb.storage.from('images').upload(path,file,{contentType:file.type});
      if(up.error)throw up.error;
      image_url=sb.storage.from('images').getPublicUrl(path).data.publicUrl;
    }
    const {error}=await sb.from('posts').insert({section:sec,title,body,image_url,author_id:me.id,author_name:me.name,author_role:me.role});
    if(error)throw error;
    buildComposer(sec,true);toast('Publicado! ✨');loadPosts(sec);
  }catch(e){toast('Erro: '+(e.message||e));btn.disabled=false;btn.textContent='Publicar'}
}
async function loadPosts(sec){
  const box=$('#list-'+sec);
  const {data,error}=await sb.from('posts').select('*').eq('section',sec).order('created_at',{ascending:false});
  if(error){box.innerHTML='<div class="card glass">Erro ao carregar.</div>';return}
  if(!data.length){box.innerHTML='<div class="card glass muted">Nada por aqui ainda.</div>';return}
  box.innerHTML=data.map(p=>`<article class="card glass post">
    <div class="meta"><span class="badge ${esc(p.author_role)}">${p.author_role==='owner'?'Owner':'Admin'}</span><b>${esc(p.author_name)}</b><span>${new Date(p.created_at).toLocaleString('pt-BR')}</span></div>
    <h3>${esc(p.title)}</h3><p>${esc(p.body)}</p>
    ${p.image_url?`<img class="pimg" loading="lazy" src="${esc(p.image_url)}">`:''}
    ${me.role==='owner'?`<div style="margin-top:8px"><button class="btn danger" data-del="${p.id}">Apagar</button></div>`:''}
  </article>`).join('');
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Apagar esta postagem?'))return;
    await sb.from('posts').delete().eq('id',b.dataset.del);loadPosts(sec)});
}

/* ---------- Owner: gerar admins ---------- */
function newCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),v=>a[v%a.length]).join('');return `LUNEX-${r(4)}-${r(4)}`}
$('#genCode').onclick=async()=>{
  const code=newCode();
  const {error}=await sb.from('admin_codes').insert({code,created_by:me.id});
  if(error){toast('Erro: '+error.message);return}
  try{await navigator.clipboard.writeText(code);toast('Código copiado: '+code)}catch(e){toast('Código: '+code)}
  loadCodes();
};
async function loadCodes(){
  const {data}=await sb.from('admin_codes').select('*').order('created_at',{ascending:false}).limit(30);
  $('#codes').innerHTML=(data||[]).map(c=>`<div class="codeitem ${c.used_by?'used':''}"><span>${esc(c.code)}</span>${c.used_by?'<span>usado</span>':`<button class="btn ghost" style="padding:6px 12px" data-copy="${esc(c.code)}">Copiar</button>`}</div>`).join('');
  $$('[data-copy]').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.copy);toast('Copiado!')});
}
})();
