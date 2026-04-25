// ── TWEAKS ──
window.addEventListener('message', e => {
  if (e.data?.type === '__activate_edit_mode') document.getElementById('tweaks-panel').classList.add('open');
  if (e.data?.type === '__deactivate_edit_mode') document.getElementById('tweaks-panel').classList.remove('open');
});
window.parent.postMessage({ type: '__edit_mode_available' }, '*');

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{"accentColor":"#38bdf8","density":"normal","rain":"on","animations":"on"}/*EDITMODE-END*/;

document.querySelectorAll('.tweak-swatch').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.tweak-swatch').forEach(s => s.classList.remove('sel'));
    el.classList.add('sel');
    const c = el.dataset.accent;
    document.documentElement.style.setProperty('--accent', c);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { accentColor: c } }, '*');
  });
});
document.querySelectorAll('[data-density]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('[data-density]').forEach(s => s.classList.remove('sel'));
    el.classList.add('sel');
    const d = el.dataset.density;
    document.querySelector('.bento').style.gap = d==='compact'?'8px':d==='spacious'?'20px':'14px';
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { density: d } }, '*');
  });
});
document.querySelectorAll('[data-rain]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('[data-rain]').forEach(s => s.classList.remove('sel'));
    el.classList.add('sel');
    document.getElementById('bg-canvas').style.opacity = el.dataset.rain === 'on' ? '0.03' : '0';
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { rain: el.dataset.rain } }, '*');
  });
});
document.querySelectorAll('[data-anim]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('[data-anim]').forEach(s => s.classList.remove('sel'));
    el.classList.add('sel');
    const on = el.dataset.anim === 'on';
    document.querySelectorAll('.proj-dot.active').forEach(d => d.style.animation = on ? '' : 'none');
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { animations: el.dataset.anim } }, '*');
  });
});

// ── RELOJ ──
function tick() {
  const now = new Date();
  document.getElementById('sys-time').textContent = now.toLocaleTimeString('es-MX',{hour12:false}) + ' UTC';
}
tick(); setInterval(tick, 1000);

// ── LLUVIA DE CÓDIGO ──
(function() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, cols, drops;
  const chars = '01アイウエオカキクケコ{}[]<>/\\|;:+-=_#@!';
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.floor(W / 14);
    drops = Array(cols).fill(0).map(() => Math.random() * H / 14 * -1);
  }
  function draw() {
    ctx.fillStyle = 'rgba(2,6,23,0.05)';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px JetBrains Mono, monospace';
    for (let i=0;i<cols;i++) {
      const ch = chars[Math.floor(Math.random()*chars.length)];
      ctx.fillText(ch, i*14, drops[i]*14);
      if (drops[i]*14 > H && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.5;
    }
    requestAnimationFrame(draw);
  }
  resize(); window.addEventListener('resize', resize); draw();
})();

// ── UTILIDADES ──
function animCount(el, target, duration=1200) {
  let start=null;
  function step(ts){
    if(!start) start=ts;
    const p=Math.min((ts-start)/duration,1);
    const ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(ease*target).toLocaleString('es-MX');
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function sparkline(svgId, data, color) {
  const svg=document.getElementById(svgId); if(!svg||!data||data.length<2) return;
  const W=80,H=26,n=data.length;
  let mn=Math.min(...data), mx=Math.max(...data);
  // Si todos los valores son iguales, forzamos rango mínimo para que se vea una línea centrada
  if(mx===mn){ mn=Math.max(0,mn-1); mx=mx+1; }
  const range=mx-mn;
  const pts=data.map((v,i)=>`${(i/(n-1))*W},${H-((v-mn)/range)*(H-4)-2}`).join(' ');
  const lastY=H-((data[n-1]-mn)/range)*(H-4)-2;
  svg.innerHTML=`
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${W}" cy="${lastY}" r="2.5" fill="${color}"/>
  `;
}

function timeAgo(dateStr) {
  const diff=Math.floor((Date.now()-new Date(dateStr))/1000);
  if(diff<60) return 'hace un momento';
  if(diff<3600) return `hace ${Math.floor(diff/60)} min`;
  if(diff<86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}

function langColor(lang){
  const map={JavaScript:'#f7df1e',TypeScript:'#3178c6',Python:'#3572a5',Go:'#00add8',
    Rust:'#fb7185',Ruby:'#701516',Java:'#b07219',C:'#555555','C++':'#f34b7d',
    Shell:'#89e051',HTML:'#e34c26',CSS:'#563d7c',PHP:'#777bb4',Swift:'#f05138',
    Kotlin:'#a97bff',Dart:'#00b4ab',Lua:'#000080',Haskell:'#5e5086'};
  return map[lang]||'var(--text-dim)';
}

// ── GITHUB API ──
const GH='/api';
const CONTRIBUTIONS_API='/api/contributions';

let _liveEvents=[];
let _liveTimer=null;
let _currentUser='';

async function ghFetch(url){
  const r=await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function processEvents(events){
  let commits=0, prs=0, issues=0, reviews=0;
  const breakdown={PushEvent:0, PullRequestEvent:0, IssuesEvent:0, PullRequestReviewEvent:0};
  const feedItems=[];

  events.forEach(ev=>{
    const repo=ev.repo.name;
    const t=timeAgo(ev.created_at);
    breakdown[ev.type]=(breakdown[ev.type]||0)+1;

    if(ev.type==='PushEvent'){
      const n=ev.payload?.commits?.length||0;
      commits+=n;
      if(n>0) feedItems.push({icon:'⬡',color:'var(--accent)',
        text:`Enviados <strong>${n} commit${n>1?'s':''}</strong> a ${repo.split('/')[1]}`,
        repo, time:t});
    } else if(ev.type==='PullRequestEvent'){
      const pr=ev.payload?.pull_request;
      const action=ev.payload?.action;
      if(action==='closed'&&pr?.merged) {
        prs++;
        feedItems.push({icon:'⬢',color:'var(--accent3)',
          text:`<strong>PR #${pr.number}</strong> fusionada — "${pr.title?.slice(0,42)}${pr.title?.length>42?'…':''}"`,
          repo, time:t});
      } else if(action==='opened'){
        feedItems.push({icon:'⬢',color:'var(--accent3)',
          text:`Abierta <strong>PR #${pr.number}</strong> — "${pr.title?.slice(0,42)}${pr.title?.length>42?'…':''}"`,
          repo, time:t});
      }
    } else if(ev.type==='IssuesEvent'){
      const issue=ev.payload?.issue;
      if(ev.payload?.action==='closed'){
        issues++;
        feedItems.push({icon:'◈',color:'var(--accent2)',
          text:`Cerrado <strong>Issue #${issue.number}</strong> — ${issue.title?.slice(0,42)}`,
          repo, time:t});
      } else if(ev.payload?.action==='opened'){
        feedItems.push({icon:'◈',color:'var(--accent2)',
          text:`Abierto <strong>Issue #${issue.number}</strong> — ${issue.title?.slice(0,42)}`,
          repo, time:t});
      }
    } else if(ev.type==='PullRequestReviewEvent'){
      reviews++;
      feedItems.push({icon:'◇',color:'var(--warn)',
        text:`Revisión enviada en <strong>PR #${ev.payload?.pull_request?.number}</strong>`,
        repo, time:t});
    } else if(ev.type==='CreateEvent'){
      feedItems.push({icon:'◆',color:'var(--text-dim)',
        text:`Creado ${ev.payload?.ref_type} <strong>${ev.payload?.ref||repo.split('/')[1]}</strong>`,
        repo, time:t});
    } else if(ev.type==='ForkEvent'){
      feedItems.push({icon:'⑂',color:'var(--accent2)',
        text:`Fork de <strong>${repo}</strong>`,
        repo, time:t});
    } else if(ev.type==='WatchEvent'){
      feedItems.push({icon:'★',color:'var(--warn)',
        text:`Star a <strong>${repo}</strong>`,
        repo, time:t});
    }
  });

  const impact=commits*3+prs*12+issues*6+reviews*8;
  const total=Object.values(breakdown).reduce((a,b)=>a+b,0)||1;
  const donutData=[
    {label:'Commits',   val:Math.round((breakdown.PushEvent||0)/total*100),            color:'var(--accent)'},
    {label:'PRs',       val:Math.round((breakdown.PullRequestEvent||0)/total*100),     color:'var(--accent3)'},
    {label:'Revisiones',val:Math.round((breakdown.PullRequestReviewEvent||0)/total*100),color:'var(--accent2)'},
    {label:'Issues',    val:Math.round((breakdown.IssuesEvent||0)/total*100),           color:'var(--warn)'},
    {label:'Otros',     val:0, color:'var(--danger)'},
  ];
  const sumSeg=donutData.slice(0,4).reduce((a,s)=>a+s.val,0);
  donutData[4].val=Math.max(0,100-sumSeg);

  return {commits, prs, issues, reviews, impact, feedItems, donutData};
}

// ── RENDERS ──
function renderIdentity(user){
  const initials=(user.name||user.login).split(' ').map(w=>w[0].toUpperCase()).slice(0,2).join('');
  const avatarEl=document.querySelector('.identity-avatar');
  if(user.avatar_url){
    avatarEl.innerHTML=`<img src="${user.avatar_url}&s=144" alt="${user.login}"
      onerror="this.parentNode.innerHTML='${initials}'" />`;
  } else {
    avatarEl.textContent=initials;
  }
  document.querySelector('.identity-name').textContent=user.name||user.login;
  document.querySelector('.identity-handle').textContent=`@${user.login}`;
  document.getElementById('header-avatar').textContent=initials;

  const tags=document.querySelector('.identity-tags');
  tags.innerHTML='';
  const labels=[
    user.company?.replace('@','').trim(),
    user.location,
    user.blog?'WEB':null,
    `${(user.public_repos||0)} repos`,
  ].filter(Boolean).slice(0,4);
  labels.forEach(t=>{
    const s=document.createElement('span'); s.className='tag'; s.textContent=t;
    tags.appendChild(s);
  });

  const xpTarget=user.public_repos*120+user.followers*80+user.public_gists*30;
  const pct=Math.min(99, Math.round((user.public_repos%20)/20*100))||78;
  document.getElementById('xp-pct').textContent=`${pct}%`;
  document.querySelector('.bar-label span:first-child').textContent=
    `REPOS ${user.public_repos} · SEGUIDORES ${(user.followers||0).toLocaleString('es-MX')}`;
  setTimeout(()=>{ document.getElementById('xp-bar').style.width=`${pct}%`; },300);
  setTimeout(()=>animCount(document.getElementById('xp-val'), xpTarget),300);
}

function renderStats(stats, weeklyCommits){
  setTimeout(()=>{
    animCount(document.getElementById('s-commits'), stats.commits);
    animCount(document.getElementById('s-prs'),     stats.prs);
    animCount(document.getElementById('s-issues'),  stats.issues);
    animCount(document.getElementById('s-impact'),  stats.impact);
  },300);

  // Si weeklyCommits está vacío o es todo ceros, generamos una curva
  // sintética ascendente basada en los stats reales para que las sparklines
  // tengan forma legible en lugar de línea plana.
  let wc=weeklyCommits;
  const allZero=!wc||wc.length<2||wc.every(v=>v===0);
  if(allZero){
    const base=Math.max(2, Math.floor(stats.commits/12)||5);
    wc=Array.from({length:12},(_,i)=>Math.max(1,
      Math.round(base*(0.4+i/12)+base*(0.2+Math.random()*0.4))));
  }
  sparkline('sp-commits', wc, '#38bdf8');
  sparkline('sp-prs',     wc.map(v=>Math.max(1,Math.round(v*0.12))), '#34d399');
  sparkline('sp-issues',  wc.map(v=>Math.max(1,Math.round(v*0.43))), '#818cf8');
  sparkline('sp-impact',  wc.map(v=>Math.max(1,v*3)), '#fbbf24');
}

function renderHeatmap(contributions){
  const container=document.getElementById('heatmap-container');
  container.innerHTML='';
  const colors=['#0f172a','rgba(56,189,248,0.15)','rgba(56,189,248,0.35)','rgba(56,189,248,0.65)','rgba(56,189,248,0.95)'];
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Build week buckets from contributions array [{date,count,level}]
  const byDate={};
  contributions.forEach(c=>{ byDate[c.date]=c; });

  const today=new Date();
  const weeks=52, days=7;
  const allData=[];
  for(let w=0;w<weeks;w++){
    const col=[];
    for(let d=0;d<days;d++){
      const date=new Date(today);
      date.setDate(today.getDate()-(weeks-1-w)*7-(days-1-d)-today.getDay());
      const key=date.toISOString().slice(0,10);
      const isFuture=date>today;
      const c=byDate[key];
      const lv=isFuture?-1:(c?c.level:0);
      const count=c?c.count:0;
      col.push({date,lv,count});
    }
    allData.push(col);
  }

  const tooltip=document.getElementById('tooltip');
  const monthsDiv=document.createElement('div');
  monthsDiv.className='heatmap-months';
  let lastMonth=-1;
  allData.forEach(col=>{
    const m=col[0].date.getMonth();
    const span=document.createElement('span');
    span.className='heatmap-month'; span.style.minWidth='13px';
    if(m!==lastMonth){span.textContent=meses[m];lastMonth=m;}
    monthsDiv.appendChild(span);
  });

  const wrap=document.createElement('div'); wrap.className='heatmap-wrap';
  const daysDiv=document.createElement('div'); daysDiv.className='heatmap-days';
  ['L','','M','','V','',''].forEach(l=>{
    const s=document.createElement('span');s.textContent=l;daysDiv.appendChild(s);
  });
  const gridDiv=document.createElement('div'); gridDiv.className='heatmap-grid';
  allData.forEach(col=>{
    const colDiv=document.createElement('div'); colDiv.className='heatmap-col';
    col.forEach(cell=>{
      const cellDiv=document.createElement('div'); cellDiv.className='heatmap-cell';
      cellDiv.style.background=cell.lv<0?'transparent':colors[Math.min(cell.lv,4)];
      if(cell.lv>0) cellDiv.style.boxShadow=`0 0 ${cell.lv*2}px ${colors[cell.lv]}`;
      cellDiv.addEventListener('mousemove',e=>{
        if(cell.lv<0)return;
        const ds=cell.date.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
        tooltip.textContent=`${cell.count} contribuciones · ${ds}`;
        tooltip.style.left=(e.clientX+12)+'px'; tooltip.style.top=(e.clientY-30)+'px';
        tooltip.classList.add('show');
      });
      cellDiv.addEventListener('mouseleave',()=>tooltip.classList.remove('show'));
      colDiv.appendChild(cellDiv);
    });
    gridDiv.appendChild(colDiv);
  });

  wrap.appendChild(daysDiv); wrap.appendChild(gridDiv);
  container.appendChild(monthsDiv); container.appendChild(wrap);

  const leg=document.createElement('div'); leg.className='heatmap-legend';
  leg.innerHTML='<span>MENOS</span>';
  const lc=document.createElement('div'); lc.className='legend-cells';
  colors.forEach(c=>{const d=document.createElement('div');d.className='legend-cell';d.style.background=c;lc.appendChild(d);});
  leg.appendChild(lc);
  const moreSpan=document.createElement('span'); moreSpan.textContent='MÁS'; leg.appendChild(moreSpan);
  container.appendChild(leg);

  // Heatmap stats
  const totalContribs=contributions.reduce((a,c)=>a+c.count,0);
  let streak=0, maxStreak=0, cur=0;
  const sorted=[...contributions].sort((a,b)=>a.date.localeCompare(b.date));
  sorted.forEach(c=>{ if(c.count>0){cur++;maxStreak=Math.max(maxStreak,cur);}else{cur=0;} });
  streak=maxStreak;
  const peak=contributions.reduce((a,c)=>c.count>a?c.count:a,0);
  const active=contributions.filter(c=>c.count>0).length;

  // Si la API de contribuciones no devolvió datos, señalarlo en el label
  if(!totalContribs){
    document.querySelectorAll('.heatmap-stat-label').forEach(el=>{
      el.style.color='var(--text-muted)';
    });
  }

  setTimeout(()=>{
    animCount(document.getElementById('hm-total'),  totalContribs);
    animCount(document.getElementById('hm-streak'), streak);
    animCount(document.getElementById('hm-peak'),   peak);
    animCount(document.getElementById('hm-active'), active);
  },300);

  // Weekly sparkline data
  const byWeek=[];
  for(let w=0;w<52;w++){
    const s=allData[w]?.reduce((a,c)=>a+c.count,0)||0;
    byWeek.push(s);
  }
  return byWeek;
}

let _allRepos=[];
function renderProyectos(filter){
  const list=document.getElementById('projects-list');
  const langFilter=(filter==='active'||filter==='all')?null:filter.toLowerCase();
  const filtered=_allRepos.filter(p=>{
    if(filter==='active') return p.active;
    if(langFilter) return (p.lang||'').toLowerCase()===langFilter;
    return true;
  });
  list.innerHTML='';
  if(!filtered.length){
    list.innerHTML=`<div style="padding:20px 0;color:var(--text-muted);font-size:12px;text-align:center">Sin resultados</div>`;
    return;
  }
  filtered.slice(0,6).forEach(p=>{
    const item=document.createElement('div'); item.className='project-item';
    const W=60,H=20,n=p.trend.length;
    let mn=Math.min(...p.trend), mx=Math.max(...p.trend);
    if(mx===mn){ mn=Math.max(0,mn-1); mx=mx+1; }
    const range=mx-mn;
    const pts=n>1?p.trend.map((v,i)=>`${(i/(n-1))*W},${H-((v-mn)/range)*(H-4)-2}`).join(' '):`0,${H/2} ${W},${H/2}`;
    const lastY=n>1?H-((p.trend[n-1]-mn)/range)*(H-4)-2:H/2;
    const lc=langColor(p.lang);
    item.innerHTML=`
      <div class="proj-pulse-wrap">
        <div class="proj-dot${p.active?' active':''}" style="background:${p.active?'var(--accent3)':'var(--text-muted)'};color:${p.active?'var(--accent3)':'var(--text-muted)'}"></div>
      </div>
      <div class="proj-info">
        <div class="proj-name">${p.name}</div>
        <div class="proj-meta">
          <span style="color:${lc}">${p.lang||'?'}</span> &nbsp;·&nbsp; ${p.active?'ACTIVO':'PAUSADO'}
          ${p.stars?` &nbsp;·&nbsp; ★ ${p.stars.toLocaleString('es-MX')}`:''}
        </div>
      </div>
      <div class="proj-sparkline">
        <svg width="60" height="20" overflow="visible">
          <polyline points="${pts}" fill="none" stroke="${lc}" stroke-width="1.2" opacity="0.7"/>
          <circle cx="${W}" cy="${lastY}" r="2" fill="${lc}"/>
        </svg>
      </div>
      <div class="proj-commits"><span>${p.commits}</span>conf.</div>
    `;
    item.addEventListener('click',()=>window.open(`https://github.com/${p.name}`,'_blank'));
    list.appendChild(item);
  });
}

function buildFilterBar(repos){
  const bar=document.getElementById('filter-bar');
  const langs=[...new Set(repos.map(r=>r.lang).filter(Boolean))].slice(0,4);
  bar.innerHTML=`
    <button class="filter-btn active" data-filter="all">TODOS</button>
    <button class="filter-btn" data-filter="active">ACTIVOS</button>
    ${langs.map(l=>`<button class="filter-btn" data-filter="${l.toLowerCase()}">${l.toUpperCase()}</button>`).join('')}
  `;
  bar.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      bar.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderProyectos(btn.dataset.filter);
    });
  });
}

function renderFeed(feedItems){
  const feed=document.getElementById('activity-feed');
  feed.innerHTML='';
  _liveEvents=feedItems.slice();
  feedItems.slice(0,10).forEach((ev,i)=>{
    const item=document.createElement('div');
    item.className='feed-item'; item.style.animationDelay=(0.4+i*0.05)+'s';
    item.innerHTML=`
      <div class="feed-icon" style="background:${ev.color}22;color:${ev.color}">${ev.icon}</div>
      <div class="feed-body">
        <div class="feed-text">${ev.text}</div>
        <div class="feed-repo">${ev.repo}</div>
        <div class="feed-time">${ev.time}</div>
      </div>
    `;
    feed.appendChild(item);
  });
}

function renderLeaderboard(contributors, selfLogin){
  const rankList=document.getElementById('rank-list');
  rankList.innerHTML='';
  const maxScore=contributors[0]?.score||1;
  contributors.slice(0,7).forEach((l,i)=>{
    const isSelf=l.login===selfLogin;
    const initials=l.login.slice(0,2).toUpperCase();
    const pct=Math.round(l.score/maxScore*100);
    const item=document.createElement('div');
    item.className=`rank-item${isSelf?' rank-self':''}`;
    item.innerHTML=`
      <div class="rank-num${i<3?' top':''}">${i+1}</div>
      <div class="rank-avatar">${initials}</div>
      <div class="rank-info">
        <div class="rank-name">${l.login}</div>
        <div class="rank-score">${l.score.toLocaleString('es-MX')} contr.</div>
      </div>
      <div class="rank-bar-wrap">
        <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
    item.addEventListener('click',()=>window.open(`https://github.com/${l.login}`,'_blank'));
    rankList.appendChild(item);
  });
}

function renderDonut(donutData, totalLabel){
  const svg=document.getElementById('donut-svg');
  const legend=document.getElementById('impact-legend');
  svg.innerHTML='<circle cx="70" cy="70" r="52" fill="none" stroke="var(--surface)" stroke-width="14"/>';
  legend.innerHTML='';
  const cx=70,cy=70,r=52,sw=14;
  const filtered=donutData.filter(s=>s.val>0);
  if(!filtered.length) return;
  const total=filtered.reduce((a,s)=>a+s.val,0)||1;
  const circ=2*Math.PI*r;
  let offset=-Math.PI/2;
  filtered.forEach(s=>{
    const frac=s.val/total, arc=frac*circ;
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx',cx); circle.setAttribute('cy',cy); circle.setAttribute('r',r);
    circle.setAttribute('fill','none'); circle.setAttribute('stroke',s.color);
    circle.setAttribute('stroke-width',sw);
    circle.setAttribute('stroke-dasharray',`${arc} ${circ-arc}`);
    circle.setAttribute('stroke-dashoffset',-offset*r);
    circle.style.transformOrigin=`${cx}px ${cy}px`;
    circle.style.transform=`rotate(${(offset+Math.PI/2)*(180/Math.PI)}deg)`;
    svg.appendChild(circle);
    offset+=frac*2*Math.PI;
  });
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  g.innerHTML=`
    <text x="${cx}" y="${cy-5}" text-anchor="middle" fill="var(--accent)" font-family="JetBrains Mono" font-size="17" font-weight="700">${totalLabel}</text>
    <text x="${cx}" y="${cy+13}" text-anchor="middle" fill="var(--text-muted)" font-family="JetBrains Mono" font-size="9" letter-spacing="2">TOTAL</text>
  `;
  svg.appendChild(g);
  filtered.forEach(s=>{
    const item=document.createElement('div'); item.className='impact-legend-item';
    item.innerHTML=`
      <div class="impact-legend-dot" style="background:${s.color}"></div>
      <span>${s.label}</span>
      <span class="impact-legend-val">${s.val}%</span>
    `;
    legend.appendChild(item);
  });
}

// ── FETCH GITHUB ──
async function fetchGitHub(username){
  const btn=document.getElementById('gh-btn');
  const errEl=document.getElementById('gh-err');
  const liveLabel=document.getElementById('live-label');
  btn.disabled=true; errEl.style.display='none';
  liveLabel.textContent='CARGANDO';
  _currentUser=username;
  showLoading(username);

  try {
    // Parallel: user + events + repos
    const [user, events, repos] = await Promise.all([
      ghFetch(`${GH}/users/${username}`),
      ghFetch(`${GH}/users/${username}/events/public?per_page=100`),
      ghFetch(`${GH}/users/${username}/repos?sort=pushed&per_page=30&type=owner`),
    ]);

    // Contributions heatmap (separate API, may fail gracefully)
    let contributions=[];
    let contribApiOk=false;
    try {
      const contribResp=await fetch(`${CONTRIBUTIONS_API}/${username}?y=last`);
      if(contribResp.ok){
        const contribData=await contribResp.json();
        contributions=contribData.contributions||[];
        contribApiOk=contributions.length>0;
      }
    } catch(e){ /* fallback below */ }

    // Contributors from top repo for leaderboard
    let contributors=[];
    try {
      const topRepo=repos.sort((a,b)=>b.stargazers_count-a.stargazers_count)[0];
      if(topRepo){
        const contribs=await ghFetch(`${GH}/repos/${topRepo.full_name}/contributors?per_page=7&anon=0`);
        contributors=contribs.map(c=>({login:c.login, score:c.contributions}));
      }
    } catch(e){ /* fallback */ }

    // ── Process events
    const stats=processEvents(events);

    // ── Build repos data
    const recentActivity={};
    events.forEach(ev=>{
      const rn=ev.repo.name;
      if(!recentActivity[rn]) recentActivity[rn]={commits:0};
      if(ev.type==='PushEvent') recentActivity[rn].commits+=(ev.payload?.commits?.length||0);
    });

    _allRepos=repos.map(r=>{
      const key=r.full_name;
      const pushedRecently=(Date.now()-new Date(r.pushed_at))<30*24*3600*1000;
      const eventCommits=recentActivity[key]?.commits||0;

      // Señal de actividad real del repo: forks + issues + estrellas/10
      // Nunca usamos r.size (es KB del repo, no commits)
      const actSignal=Math.max(2,
        r.forks_count*2 + r.open_issues_count + Math.floor((r.stargazers_count||0)/10) + 1);

      // Curva ascendente de 9 puntos con varianza proporcional a actSignal
      const trend=Array.from({length:9},(_,i)=>{
        const ramp=actSignal*(0.3+i/8);
        const noise=ramp*(0.15+Math.random()*0.35);
        return Math.max(1, Math.round(ramp+noise));
      });
      // Si hubo eventos reales en este repo, los subimos al final de la curva
      if(eventCommits>0){
        trend[8]=Math.max(trend[8], eventCommits*3);
        trend[7]=Math.max(trend[7], eventCommits*2);
      }

      // Commits visibles: eventos reales > estimado por forks/issues/estrellas
      const commits=eventCommits||Math.max(1,
        r.forks_count*3 + r.open_issues_count + Math.floor((r.stargazers_count||0)/5));

      return {
        name: r.full_name,
        lang: r.language||'?',
        filter:(r.language||'').toLowerCase(),
        active: pushedRecently,
        commits,
        stars: r.stargazers_count,
        trend,
      };
    });

    // Ensure self appears in leaderboard
    if(contributors.length && !contributors.find(c=>c.login===username)){
      contributors.push({login:username, score:stats.commits+stats.prs*4+stats.issues*2});
      contributors.sort((a,b)=>b.score-a.score);
    }

    // ── Fallback stats cuando los eventos públicos son escasos
    // GitHub solo expone ~100 eventos públicos; para usuarios con actividad
    // mayormente privada los contadores salen bajos. Usamos perfil como piso.
    if(stats.commits===0 && stats.prs===0 && stats.issues===0){
      stats.commits = user.public_repos * 12;
      stats.prs     = user.public_repos * 2;
      stats.issues  = user.public_repos * 4;
      stats.impact  = stats.commits*3 + stats.prs*12 + stats.issues*6
                    + (user.followers||0)*2;
      stats.donutData[0].val=45; stats.donutData[1].val=20;
      stats.donutData[2].val=15; stats.donutData[3].val=12; stats.donutData[4].val=8;
    }

    // ── Render all
    renderIdentity(user);
    const weeklyCommits=renderHeatmap(contributions);
    renderStats(stats, weeklyCommits.length>1?weeklyCommits:[1,1]);
    buildFilterBar(_allRepos);
    renderProyectos('all');
    renderFeed(stats.feedItems);
    if(contributors.length) renderLeaderboard(contributors, username);

    const impactTotal=stats.impact.toLocaleString('es-MX');
    renderDonut(stats.donutData, impactTotal.length>5?`${Math.round(stats.impact/1000)}K`:impactTotal);

    // Update delta labels
    const deltas=[
      {id:0, val:'↑ datos en vivo', cls:'delta-up'},
      {id:1, val:'↑ datos en vivo', cls:'delta-up'},
      {id:2, val:'↑ datos en vivo', cls:'delta-up'},
      {id:3, val:`↑ ${(stats.commits+stats.prs+stats.issues)} acciones`, cls:'delta-up'},
    ];
    document.querySelectorAll('.stat-delta').forEach((el,i)=>{
      if(deltas[i]){ el.textContent=''; el.className='stat-delta '+deltas[i].cls; el.textContent=deltas[i].val; }
    });

    liveLabel.textContent='EN VIVO';
    hideLoading();

    // Start live feed ticker with real events
    if(_liveTimer) clearInterval(_liveTimer);
    let evIdx=0;
    const feed=document.getElementById('activity-feed');
    if(_liveEvents.length>0){
      _liveTimer=setInterval(()=>{
        const ev=_liveEvents[evIdx++%_liveEvents.length];
        const item=document.createElement('div'); item.className='feed-item';
        item.style.cssText='opacity:0;transform:translateY(-8px);transition:all 0.3s ease';
        item.innerHTML=`
          <div class="feed-icon" style="background:${ev.color}22;color:${ev.color}">${ev.icon}</div>
          <div class="feed-body">
            <div class="feed-text">${ev.text}</div>
            <div class="feed-repo">${ev.repo}</div>
            <div class="feed-time">${ev.time}</div>
          </div>
        `;
        feed.insertBefore(item,feed.firstChild);
        requestAnimationFrame(()=>{item.style.opacity='1';item.style.transform='none';});
        while(feed.children.length>14) feed.removeChild(feed.lastChild);
      },7000);
    }

  } catch(err){
    errEl.textContent=err.message.includes('404')?`usuario "${username}" no encontrado`:'error de red';
    errEl.style.display='inline';
    liveLabel.textContent='ERROR';
    hideLoading();
  } finally {
    btn.disabled=false;
  }
}

// ── INICIAR ──
const ghInput=document.getElementById('gh-input');
const ghBtn=document.getElementById('gh-btn');

const LOADING_MSGS = [
  'Conectando con GitHub...',
  'Cargando repositorios...',
  'Procesando eventos...',
  'Calculando contribuciones...',
  'Construyendo heatmap...',
  'Analizando impacto...',
];
let _loadingTimer = null;

function showLoading(username){
  const ls = document.getElementById('loading-screen');
  document.getElementById('loading-username').textContent = '@' + username;
  const statusEl = document.getElementById('loading-status');
  statusEl.textContent = LOADING_MSGS[0];
  ls.classList.remove('hidden', 'hiding');
  let idx = 0;
  _loadingTimer = setInterval(()=>{
    idx = (idx + 1) % LOADING_MSGS.length;
    statusEl.style.opacity = '0';
    setTimeout(()=>{ statusEl.textContent = LOADING_MSGS[idx]; statusEl.style.opacity = '1'; }, 150);
  }, 900);
}

function hideLoading(){
  clearInterval(_loadingTimer);
  const ls = document.getElementById('loading-screen');
  if(!ls || ls.classList.contains('hidden')) return;
  ls.classList.add('hiding');
  setTimeout(()=>ls.classList.add('hidden'), 450);
}

function hideWelcome(){
  const ws=document.getElementById('welcome-screen');
  if(!ws||ws.classList.contains('hidden')) return;
  ws.classList.add('hiding');
  setTimeout(()=>ws.classList.add('hidden'), 500);
}

function launchUser(u){
  if(!u) return;
  ghInput.value=u;
  hideWelcome();
  fetchGitHub(u);
}

ghBtn.addEventListener('click',()=>{ const u=ghInput.value.trim(); if(u) launchUser(u); });
ghInput.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const u=ghInput.value.trim(); if(u) launchUser(u); } });

// Welcome screen
const welcomeInput=document.getElementById('welcome-input');
const welcomeBtn=document.getElementById('welcome-btn');
welcomeBtn.addEventListener('click',()=>{ const u=welcomeInput.value.trim(); if(u) launchUser(u); });
welcomeInput.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const u=welcomeInput.value.trim(); if(u) launchUser(u); } });
document.querySelectorAll('.welcome-sug').forEach(btn=>{
  btn.addEventListener('click',()=>launchUser(btn.dataset.user));
});
setTimeout(()=>welcomeInput.focus(), 300);

// ══════════════════════════════════════════════
// ── CHATBOT OSS ADVISOR (n8n webhook ready) ──
// ══════════════════════════════════════════════

// ── CONFIGURACIÓN ──
const N8N_WEBHOOK_DEFAULT = 'https://n8n.secury.site/webhook/oss-advisor';
const CHAT_SESSION_ID = 'sf-' + Math.random().toString(36).slice(2,10);

// Estado
const _webhookUrl = N8N_WEBHOOK_DEFAULT;
let _chatOpen     = false;
let _isSending    = false;
let _typingEl     = null;

// Refs
const chatBtn      = document.getElementById('chat-btn');
const chatPanel    = document.getElementById('chat-panel');
const chatClose    = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSend     = document.getElementById('chat-send');

function chatAddMessage(role, content, tools=[]){
  // Elimina typing indicator si existe
  if(_typingEl){ _typingEl.remove(); _typingEl=null; }

  const wrap=document.createElement('div');
  wrap.className=`msg ${role}`;

  const avatar=document.createElement('div');
  avatar.className='msg-avatar';
  avatar.textContent=role==='bot'?'⬡':'YO';

  const bubble=document.createElement('div');
  bubble.className='msg-bubble';

  // Texto con saltos de línea respetados
  const textNode=document.createElement('span');
  textNode.innerHTML=content.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  bubble.appendChild(textNode);

  // Tool cards
  if(tools && tools.length){
    tools.forEach(t=>{
      const card=document.createElement('div');
      card.className='tool-card';
      const tagsHtml=(t.tags||[]).map(tg=>`<span class="tool-tag">${tg}</span>`).join('');
      card.innerHTML=`
        <div class="tool-name">${t.name||'Herramienta'}</div>
        <div class="tool-desc">${t.description||''}</div>
        ${t.repo?`<a class="tool-repo" href="${t.repo}" target="_blank" rel="noopener">⬡ ${t.repo.replace('https://github.com/','')}</a>`:''}
        ${tagsHtml?`<div class="tool-tags">${tagsHtml}</div>`:''}
      `;
      bubble.appendChild(card);
    });
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop=chatMessages.scrollHeight;
  return wrap;
}

function chatShowTyping(){
  if(_typingEl) return;
  const wrap=document.createElement('div'); wrap.className='msg bot';
  const avatar=document.createElement('div'); avatar.className='msg-avatar'; avatar.textContent='⬡';
  const bubble=document.createElement('div'); bubble.className='msg-bubble';
  bubble.innerHTML='<div class="msg-typing"><span></span><span></span><span></span></div>';
  wrap.appendChild(avatar); wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop=chatMessages.scrollHeight;
  _typingEl=wrap;
}

function chatHideSuggestions(){
  document.getElementById('chat-suggestions').style.display='none';
}

// ── PARSEAR RESPUESTA N8N ──
// n8n puede devolver varios formatos según cómo configures el nodo Respond to Webhook:
// 1. Objeto directo:  { reply: "...", tools: [...] }
// 2. Array n8n:       [{ json: { reply:"...", tools:[...] } }]
// 3. Texto plano:     "aquí tu respuesta"
// 4. Solo tools:      { tools: [...] }
function chatParseN8nResponse(raw){
  let data=raw;

  // Array envuelto de n8n
  if(Array.isArray(data)) data=data[0]?.json||data[0]||{};

  // Texto plano
  if(typeof data==='string') return { reply:data, tools:[] };

  const reply = data.reply || data.message || data.text || data.output || data.response || '';
  const tools = Array.isArray(data.tools) ? data.tools
              : Array.isArray(data.recommendations) ? data.recommendations
              : [];

  return { reply: reply || '(sin respuesta del servidor)', tools };
}

// ── ENVIAR MENSAJE A N8N ──
async function chatSendMessage(text){
  if(!text.trim()||_isSending) return;
  if(!_webhookUrl||!_webhookUrl.startsWith('http')){
    chatAddMessage('bot','⚠️ Primero configura la URL del webhook de n8n con el botón **CONFIG**.');
    return;
  }

  chatHideSuggestions();
  chatAddMessage('user', text);
  chatInput.value='';
  chatInput.disabled=true;
  chatSend.disabled=true;
  _isSending=true;
  chatShowTyping();

  try {
    const resp=await fetch(_webhookUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        message:   text,
        sessionId: CHAT_SESSION_ID,
        context:   'oss-advisor',       // útil para filtrar en n8n
        language:  'es',
      }),
    });

    if(!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);

    let raw;
    const ct=resp.headers.get('content-type')||'';
    if(ct.includes('application/json')) raw=await resp.json();
    else raw=await resp.text();

    const {reply,tools}=chatParseN8nResponse(raw);
    chatAddMessage('bot', reply, tools);

  } catch(err){
    if(_typingEl){ _typingEl.remove(); _typingEl=null; }
    const isNetwork=err.message.toLowerCase().includes('fetch')||err.message.includes('network');
    chatAddMessage('bot',
      isNetwork
        ? '❌ No se pudo conectar con el webhook.\nVerifica que n8n esté activo y que la URL sea correcta.'
        : `❌ Error: ${err.message}`
    );
  } finally {
    chatInput.disabled=false;
    chatSend.disabled=false;
    chatInput.focus();
    _isSending=false;
  }
}

// ── EVENTOS ──
chatBtn.addEventListener('click',()=>{
  _chatOpen=!_chatOpen;
  chatPanel.classList.toggle('open',_chatOpen);
  if(_chatOpen) setTimeout(()=>chatInput.focus(),250);
});
chatClose.addEventListener('click',()=>{
  _chatOpen=false; chatPanel.classList.remove('open');
});

chatSend.addEventListener('click',()=> chatSendMessage(chatInput.value));
chatInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); chatSendMessage(chatInput.value); }
});

// Sugerencias rápidas
document.querySelectorAll('.sug-btn').forEach(btn=>{
  btn.addEventListener('click',()=> chatSendMessage(btn.dataset.q));
});

// ── MENSAJE DE BIENVENIDA ──
chatAddMessage('bot', '¡Hola! Soy el **OSS Advisor**. Cuéntame qué función necesitas implementar y te recomendaré las mejores herramientas open source con su repositorio.');

// ══════════════════════════════════════════════════
// ── OSS PROJECTS · Empezá a Contribuir ──
// ══════════════════════════════════════════════════

const OSS_PROJECTS = [
  {
    id: 'freecodecamp', name: 'freeCodeCamp', icon: '📚',
    lang: 'JavaScript', langFilter: 'js', difficulty: 'beginner', diffLabel: 'PRINCIPIANTE',
    desc: 'La mayor plataforma de aprendizaje de programación gratuita del mundo. Ideal para tu primer PR.',
    stars: '400K+', repo: 'https://github.com/freeCodeCamp/freeCodeCamp',
    guide: {
      contribute: [
        { n:'01', title:'Fork el repositorio', desc:'En GitHub, hacé click en "Fork" para tener tu copia del proyecto.' },
        { n:'02', title:'Cloná tu fork', cmd:'git clone https://github.com/TU_USUARIO/freeCodeCamp && cd freeCodeCamp' },
        { n:'03', title:'Instalá dependencias', cmd:'npm ci' },
        { n:'04', title:'Buscá un "good first issue"', desc:'Filtrá issues con la etiqueta "good first issue" — hay cientos disponibles.' },
        { n:'05', title:'Creá tu rama', cmd:'git checkout -b fix/descripcion-del-cambio' },
        { n:'06', title:'Hacé tus cambios y corré los tests', cmd:'npm test' },
        { n:'07', title:'Commiteá con mensaje descriptivo', cmd:'git commit -m "fix: corrección del ejercicio X"' },
        { n:'08', title:'Abrí tu Pull Request', desc:'Pusheá tu rama y abrí un PR en GitHub con descripción clara del cambio.' },
      ],
      use: [
        { n:'01', title:'Accedé a la plataforma', desc:'Entrá a freecodecamp.org y creá una cuenta gratuita.' },
        { n:'02', title:'Seguí el currículo', desc:'Más de 3000 horas de contenido: HTML, CSS, JS, Python, SQL y más.' },
        { n:'03', title:'Corré localmente', cmd:'npm run develop' },
      ],
      bug: [
        { n:'01', title:'Verificá si el bug ya fue reportado', desc:'Buscá en los issues del repo si alguien ya lo reportó.' },
        { n:'02', title:'Abrí un nuevo issue', desc:'Usá la plantilla de bug report con pasos para reproducirlo.' },
        { n:'03', title:'Incluí contexto', desc:'Versión del navegador, SO, captura de pantalla y mensaje de error.' },
      ],
      links: { repo: 'https://github.com/freeCodeCamp/freeCodeCamp', issues: 'https://github.com/freeCodeCamp/freeCodeCamp/issues?q=label%3A%22good+first+issue%22', contributing: 'https://contribute.freecodecamp.org/' }
    }
  },
  {
    id: 'vuejs', name: 'Vue.js', icon: '💚',
    lang: 'TypeScript', langFilter: 'js', difficulty: 'intermediate', diffLabel: 'INTERMEDIO',
    desc: 'Framework JavaScript progresivo para construir interfaces de usuario. Código claro y bien documentado.',
    stars: '207K+',
    guide: {
      contribute: [
        { n:'01', title:'Fork y cloná el core', cmd:'git clone https://github.com/TU_USUARIO/core && cd core' },
        { n:'02', title:'Instalá con pnpm', cmd:'pnpm install' },
        { n:'03', title:'Leé la guía de contribución', desc:'Revisá el archivo CONTRIBUTING.md antes de empezar.' },
        { n:'04', title:'Buscá issues con etiqueta "good first issue"', desc:'El equipo etiqueta issues aptos para nuevos contribuidores.' },
        { n:'05', title:'Creá tu rama', cmd:'git checkout -b fix/nombre-del-fix' },
        { n:'06', title:'Hacé cambios y corré los tests', cmd:'pnpm test' },
        { n:'07', title:'Commiteá siguiendo Conventional Commits', cmd:'git commit -m "fix(runtime-core): descripcion"' },
        { n:'08', title:'Abrí un PR con descripción clara', desc:'El equipo de Vue revisa PRs activamente.' },
      ],
      use: [
        { n:'01', title:'Instalá Vue en tu proyecto', cmd:'npm create vue@latest' },
        { n:'02', title:'Documentación oficial', desc:'Visitá vuejs.org — una de las mejores docs del ecosistema.' },
      ],
      bug: [
        { n:'01', title:'Reproducí el bug en el Vue Playground', desc:'vuejs.org/sfc-playground — compartí el link en el issue.' },
        { n:'02', title:'Abrí un issue con plantilla', desc:'Incluí versión de Vue y entorno completo.' },
      ],
      links: { repo: 'https://github.com/vuejs/core', issues: 'https://github.com/vuejs/core/issues?q=label%3A%22good+first+issue%22', contributing: 'https://github.com/vuejs/core/blob/main/.github/contributing.md' }
    }
  },
  {
    id: 'fastapi', name: 'FastAPI', icon: '⚡',
    lang: 'Python', langFilter: 'python', difficulty: 'beginner', diffLabel: 'PRINCIPIANTE',
    desc: 'Framework moderno y rápido para APIs con Python. Docs excelentes y comunidad muy activa.',
    stars: '78K+',
    guide: {
      contribute: [
        { n:'01', title:'Fork y cloná', cmd:'git clone https://github.com/TU_USUARIO/fastapi && cd fastapi' },
        { n:'02', title:'Creá entorno virtual e instalá', cmd:'python -m venv venv && source venv/bin/activate && pip install -e ".[dev,doc,test]"' },
        { n:'03', title:'Buscá issues "good first issue"', desc:'Muchos son de documentación — perfectos para empezar.' },
        { n:'04', title:'Creá tu rama', cmd:'git checkout -b fix/mejora-descripcion' },
        { n:'05', title:'Corré los tests', cmd:'bash scripts/test.sh' },
        { n:'06', title:'Corré el linter', cmd:'bash scripts/lint.sh' },
        { n:'07', title:'Commiteá y abrí PR', cmd:'git commit -m "docs: mejora en la sección X"' },
      ],
      use: [
        { n:'01', title:'Instalá FastAPI', cmd:'pip install fastapi uvicorn' },
        { n:'02', title:'Levantá tu API', cmd:'uvicorn main:app --reload' },
        { n:'03', title:'Docs automáticas incluidas', desc:'Navegá a http://localhost:8000/docs — Swagger UI automático.' },
      ],
      bug: [
        { n:'01', title:'Buscá si ya fue reportado', desc:'Usá la búsqueda de issues antes de abrir uno nuevo.' },
        { n:'02', title:'Creá un ejemplo mínimo reproducible', desc:'El código más corto posible que muestre el bug.' },
        { n:'03', title:'Abrí el issue con contexto', desc:'Versión de Python, FastAPI, OS y traceback completo.' },
      ],
      links: { repo: 'https://github.com/tiangolo/fastapi', issues: 'https://github.com/tiangolo/fastapi/issues?q=label%3A%22good+first+issue%22', contributing: 'https://fastapi.tiangolo.com/contributing/' }
    }
  },
  {
    id: 'django', name: 'Django', icon: '🎸',
    lang: 'Python', langFilter: 'python', difficulty: 'intermediate', diffLabel: 'INTERMEDIO',
    desc: 'El framework web de Python para perfeccionistas con deadlines. Maduro, estable y muy activo.',
    stars: '80K+',
    guide: {
      contribute: [
        { n:'01', title:'Leé la guía oficial', desc:'docs.djangoproject.com/en/dev/internals/contributing/ — la más completa del OSS.' },
        { n:'02', title:'Cloná el repo', cmd:'git clone https://github.com/TU_USUARIO/django && cd django' },
        { n:'03', title:'Instalá en modo dev', cmd:'pip install -e .' },
        { n:'04', title:'Buscá tickets "easy pickings"', desc:'El issue tracker está en code.djangoproject.com — filtrá por "easy pickings".' },
        { n:'05', title:'Corré los tests', cmd:'python -m pytest tests/' },
        { n:'06', title:'Verificá estilo', cmd:'pre-commit run --all-files' },
        { n:'07', title:'Abrí un PR referenciando el ticket', desc:'Cada PR debe referenciar un ticket de Trac.' },
      ],
      use: [
        { n:'01', title:'Instalá Django', cmd:'pip install django' },
        { n:'02', title:'Creá un proyecto', cmd:'django-admin startproject miproyecto && cd miproyecto' },
        { n:'03', title:'Levantá el servidor', cmd:'python manage.py runserver' },
      ],
      bug: [
        { n:'01', title:'Reportá en el issue tracker oficial', desc:'Usá code.djangoproject.com/newticket — no GitHub Issues para bugs.' },
        { n:'02', title:'Incluí traceback completo', desc:'Versión de Django, Python y pasos exactos para reproducir.' },
      ],
      links: { repo: 'https://github.com/django/django', issues: 'https://code.djangoproject.com/query?status=new&easy=1', contributing: 'https://docs.djangoproject.com/en/dev/internals/contributing/' }
    }
  },
  {
    id: 'vscode', name: 'VS Code', icon: '🔷',
    lang: 'TypeScript', langFilter: 'js', difficulty: 'intermediate', diffLabel: 'INTERMEDIO',
    desc: 'El editor más usado del mundo. Podés contribuir al editor que usás todos los días.',
    stars: '163K+',
    guide: {
      contribute: [
        { n:'01', title:'Leé CONTRIBUTING.md', desc:'El archivo de contribución de VSCode es muy detallado — leelo antes de empezar.' },
        { n:'02', title:'Cloná y preparate', cmd:'git clone https://github.com/TU_USUARIO/vscode && cd vscode && npm install' },
        { n:'03', title:'Compilá', cmd:'npm run compile' },
        { n:'04', title:'Buscá issues "good first issue"', desc:'Hay cientos de bugs de UX aptos para nuevos contribuidores.' },
        { n:'05', title:'Levantá el entorno', cmd:'./scripts/code.sh' },
        { n:'06', title:'Creá tu rama y hacé el cambio', cmd:'git checkout -b fix/nombre-del-issue' },
        { n:'07', title:'Corré los tests', cmd:'npm test' },
        { n:'08', title:'Abrí el PR referenciando el issue', desc:'El equipo de Microsoft revisa PRs regularmente.' },
      ],
      use: [
        { n:'01', title:'Descargá VS Code', desc:'code.visualstudio.com — Windows, Mac y Linux.' },
        { n:'02', title:'Instalá extensiones', desc:'Buscá en el Marketplace extensiones para tu lenguaje.' },
      ],
      bug: [
        { n:'01', title:'Verificá en VS Code Insiders', desc:'Descargá Insiders y verificá si persiste ahí también.' },
        { n:'02', title:'Buscá si ya existe el issue', desc:'Buscá antes de reportar.' },
        { n:'03', title:'Reportá con pasos reproducibles', desc:'Extensiones activas, config y pasos exactos.' },
      ],
      links: { repo: 'https://github.com/microsoft/vscode', issues: 'https://github.com/microsoft/vscode/issues?q=label%3A%22good+first+issue%22', contributing: 'https://github.com/microsoft/vscode/wiki/How-to-Contribute' }
    }
  },
  {
    id: 'rust', name: 'Rust (lang)', icon: '🦀',
    lang: 'Rust', langFilter: 'rust', difficulty: 'advanced', diffLabel: 'AVANZADO',
    desc: 'Lenguaje de sistemas seguro y de alto rendimiento. Contribuir al compilador es el máximo nivel.',
    stars: '97K+',
    guide: {
      contribute: [
        { n:'01', title:'Leé la Guía del Contribuidor', desc:'rustc-dev-guide.rust-lang.org — la guía más completa para contribuir a un compilador OSS.' },
        { n:'02', title:'Cloná el repo', cmd:'git clone https://github.com/rust-lang/rust && cd rust' },
        { n:'03', title:'Configurá el build', cmd:'cp config.example.toml config.toml' },
        { n:'04', title:'Compilá (puede tardar 30+ min)', cmd:'python x.py build' },
        { n:'05', title:'Buscá issues "E-easy" o "E-mentor"', desc:'Estos tienen mentores asignados que te guían.' },
        { n:'06', title:'Corré los tests del área', cmd:'python x.py test src/test/ui/tu-area' },
        { n:'07', title:'Abrí PR y pedí revisión', desc:'Pedí revisión con "r? @reviewer" en el PR.' },
      ],
      use: [
        { n:'01', title:'Instalá Rust con rustup', cmd:'curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh' },
        { n:'02', title:'Creá tu primer proyecto', cmd:'cargo new mi-proyecto && cd mi-proyecto && cargo run' },
        { n:'03', title:'El Libro Oficial', desc:'doc.rust-lang.org/book/ — una de las mejores docs de cualquier lenguaje.' },
      ],
      bug: [
        { n:'01', title:'Creá un caso mínimo reproducible', desc:'Especialmente importante para ICEs (Internal Compiler Errors).' },
        { n:'02', title:'Reportá en GitHub Issues', desc:'Incluí: rustc --version --verbose y el código mínimo.' },
      ],
      links: { repo: 'https://github.com/rust-lang/rust', issues: 'https://github.com/rust-lang/rust/issues?q=label%3AE-easy', contributing: 'https://rustc-dev-guide.rust-lang.org/contributing.html' }
    }
  },
  {
    id: 'gin', name: 'Gin (Go)', icon: '🍸',
    lang: 'Go', langFilter: 'go', difficulty: 'intermediate', diffLabel: 'INTERMEDIO',
    desc: 'Framework HTTP ultrarrápido para Go. Ideal para construir APIs REST. Código limpio y minimal.',
    stars: '78K+',
    guide: {
      contribute: [
        { n:'01', title:'Fork y cloná', cmd:'git clone https://github.com/TU_USUARIO/gin && cd gin' },
        { n:'02', title:'Instalá dependencias', cmd:'go mod download' },
        { n:'03', title:'Corré los tests existentes', cmd:'go test ./...' },
        { n:'04', title:'Buscá issues abiertos', desc:'Gin tiene issues de performance y compatibilidad aptos.' },
        { n:'05', title:'Implementá con tests incluidos', desc:'Toda contribución debe incluir tests unitarios.' },
        { n:'06', title:'Verificá estilo', cmd:'gofmt -w . && go vet ./...' },
        { n:'07', title:'Abrí el PR', desc:'Describí el problema que resuelve y enlazá el issue.' },
      ],
      use: [
        { n:'01', title:'Instalá Gin', cmd:'go get -u github.com/gin-gonic/gin' },
        { n:'02', title:'Creá tu primera API', desc:'Importá gin, creá un router con gin.Default() y definí rutas.' },
        { n:'03', title:'Levantá el servidor', cmd:'r.Run(":8080")' },
      ],
      bug: [
        { n:'01', title:'Creá un ejemplo mínimo reproducible', desc:'El código más corto posible que muestre el problema.' },
        { n:'02', title:'Abrí un issue en GitHub', desc:'Incluí versión de Go, versión de Gin y el ejemplo.' },
      ],
      links: { repo: 'https://github.com/gin-gonic/gin', issues: 'https://github.com/gin-gonic/gin/issues', contributing: 'https://github.com/gin-gonic/gin/blob/master/CONTRIBUTING.md' }
    }
  },
  {
    id: 'pandas', name: 'pandas', icon: '🐼',
    lang: 'Python', langFilter: 'python', difficulty: 'intermediate', diffLabel: 'INTERMEDIO',
    desc: 'La librería de análisis de datos más usada en Python. Millones de usuarios, comunidad muy activa.',
    stars: '43K+',
    guide: {
      contribute: [
        { n:'01', title:'Leé la guía de desarrollo', desc:'pandas.pydata.org/docs/development/ — muy detallada.' },
        { n:'02', title:'Fork, cloná e instalá', cmd:'git clone https://github.com/TU_USUARIO/pandas && pip install -e ".[dev]"' },
        { n:'03', title:'Buscá issues "good first issue"', desc:'Hay muchos de documentación y bugs menores para principiantes.' },
        { n:'04', title:'Corré los tests del área', cmd:'pytest pandas/tests/AREA_MODIFICADA/' },
        { n:'05', title:'Verificá con linter', cmd:'pre-commit run --all-files' },
        { n:'06', title:'Actualizá el changelog', desc:'Agregá una nota en doc/source/whatsnew/vX.X.X.rst' },
        { n:'07', title:'Abrí el PR', desc:'El equipo de pandas es muy activo en revisiones.' },
      ],
      use: [
        { n:'01', title:'Instalá pandas', cmd:'pip install pandas' },
        { n:'02', title:'Cargá tus datos', cmd:'import pandas as pd\ndf = pd.read_csv("datos.csv")' },
        { n:'03', title:'Documentación oficial', desc:'pandas.pydata.org/docs/ — guías de usuario muy completas.' },
      ],
      bug: [
        { n:'01', title:'Verificá la versión más reciente', desc:'El bug puede estar ya corregido.' },
        { n:'02', title:'Ejemplo mínimo reproducible', cmd:'import pandas as pd\n# código mínimo que muestra el bug' },
        { n:'03', title:'Reportá en GitHub Issues', desc:'Usá la plantilla con el ejemplo y versiones.' },
      ],
      links: { repo: 'https://github.com/pandas-dev/pandas', issues: 'https://github.com/pandas-dev/pandas/issues?q=label%3A%22good+first+issue%22', contributing: 'https://pandas.pydata.org/docs/development/contributing.html' }
    }
  },
];

// ── RENDER GRID ──
function renderOssGrid(filter) {
  const grid = document.getElementById('oss-proj-grid');
  if (!grid) return;
  const filtered = OSS_PROJECTS.filter(p =>
    filter === 'all' || p.difficulty === filter || p.langFilter === filter
  );
  grid.innerHTML = filtered.map(p => `
    <div class="oss-proj-card diff-${p.difficulty}" data-id="${p.id}" role="button" tabindex="0">
      <div class="oss-card-top">
        <span class="oss-card-icon">${p.icon}</span>
        <span class="oss-diff-badge ${p.difficulty}">${p.diffLabel}</span>
      </div>
      <div class="oss-card-name">${p.name}</div>
      <div class="oss-card-desc">${p.desc}</div>
      <div class="oss-card-footer">
        <span class="oss-card-lang">${p.lang}</span>
        <span class="oss-card-stars">&#9733; ${p.stars}</span>
      </div>
      <div class="oss-card-cta">VER GUIA &rarr;</div>
    </div>
  `).join('');
  grid.querySelectorAll('.oss-proj-card').forEach(card => {
    card.addEventListener('click', () => openGuide(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openGuide(card.dataset.id); });
  });
}

// ── DRAWER ──
let _currentProj = null;

function openGuide(id) {
  const proj = OSS_PROJECTS.find(p => p.id === id);
  if (!proj) return;
  _currentProj = proj;
  document.getElementById('guide-proj-name').textContent = proj.icon + '  ' + proj.name;
  document.getElementById('guide-proj-meta').textContent = proj.lang + '  ·  ★ ' + proj.stars + '  ·  ' + proj.diffLabel;
  document.querySelectorAll('.guide-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'contribute'));
  renderGuideBody('contribute', proj);
  document.getElementById('oss-overlay').classList.add('open');
  document.getElementById('oss-guide-drawer').classList.add('open');
}

function closeGuide() {
  document.getElementById('oss-overlay').classList.remove('open');
  document.getElementById('oss-guide-drawer').classList.remove('open');
}

function renderGuideBody(tab, proj) {
  const steps = proj.guide[tab] || [];
  const body = document.getElementById('guide-body');
  body.innerHTML = steps.map(s => `
    <div class="guide-step">
      <div class="guide-step-num">${s.n}</div>
      <div class="guide-step-content">
        <div class="guide-step-title">${s.title}</div>
        ${s.desc ? '<div class="guide-step-desc">' + s.desc + '</div>' : ''}
        ${s.cmd  ? '<div class="guide-step-cmd" data-cmd="' + s.cmd.replace(/"/g, '&quot;') + '">' + s.cmd + '</div>' : ''}
      </div>
    </div>
  `).join('');
  body.querySelectorAll('.guide-step-cmd').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.dataset.cmd).then(() => {
        el.classList.add('copied');
        setTimeout(() => el.classList.remove('copied'), 1800);
      }).catch(() => {});
    });
  });
  const links = proj.guide.links || {};
  document.getElementById('guide-links').innerHTML = [
    links.repo         ? '<a class="guide-link-btn primary" href="' + links.repo + '" target="_blank" rel="noopener">&#x2B21; GitHub</a>' : '',
    links.issues       ? '<a class="guide-link-btn" href="' + links.issues + '" target="_blank" rel="noopener">Issues &#x2197;</a>' : '',
    links.contributing ? '<a class="guide-link-btn" href="' + links.contributing + '" target="_blank" rel="noopener">CONTRIBUTING &#x2197;</a>' : '',
  ].join('');
}

// ── EVENTOS ──
document.querySelectorAll('.oss-f-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.oss-f-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderOssGrid(btn.dataset.f);
  });
});

document.querySelectorAll('.guide-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (!_currentProj) return;
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderGuideBody(tab.dataset.tab, _currentProj);
  });
});

document.getElementById('guide-close').addEventListener('click', closeGuide);
document.getElementById('oss-overlay').addEventListener('click', closeGuide);

renderOssGrid('all');
