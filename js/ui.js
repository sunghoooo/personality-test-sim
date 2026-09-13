// 화면 그리기와 사용자 조작
//
// 검사 진행 화면, 페이지 이동, 시간 제한, 리포트 출력을 담당한다.
// 계산은 전부 engine.js에 있고 여기서는 결과를 보여주기만 한다.

const app=document.getElementById('app'), foot=document.getElementById('foot');
let S=null, tick=null;
// 이력 조회용 임시 인증 정보 (페이지 새로고침 시 소멸)
let _creds=null;

/* ---------- 시작 화면 ---------- */

function intro(){
  foot.hidden=true;
  app.innerHTML=`
  <div class="top"><div class="t">HMAT 인성검사 연습</div><div class="m">CONSISTENCY CHECK</div></div>
  <div class="card">
    <h3>이 도구가 하는 일</h3>
    <p class="lead">인성검사의 응답 형식과 시간 압박을 재현하고, 검사가 끝나면 <b>같은 내용을 다르게 물었을 때 응답이 어떻게 갈렸는지</b>를 보여줍니다. 성격을 진단하지 않고, 응답 패턴만 정리합니다.</p>
    <ul>
      <li><b>검사 I</b> — 한 페이지 3세트(9문항). 문장마다 1~7 응답, 세트마다 가깝다·멀다 각 1개. 페이지당 80초</li>
      <li><b>검사 II</b> — 한 페이지 5문항, 4단계 응답. 페이지당 20초</li>
      <li>시간이 끝나면 미응답인 채로 자동으로 넘어갑니다. 응답을 모두 채우면 먼저 넘어갈 수 있고, 되돌아올 수는 없습니다.</li>
    </ul>
  </div>
  <div class="card">
    <h3>분량</h3>
    <div style="margin-bottom:10px">
      <button class="chip" data-m="full" aria-pressed="true">풀 사이즈</button>
      <button class="chip" data-m="half" aria-pressed="false">하프 사이즈</button>
      <button class="chip" data-m="quarter" aria-pressed="false">쿼터 사이즈</button>
    </div>
    <p class="lead" id="mdesc" style="margin-bottom:6px"></p>
    <p class="fine">전체 문항 풀은 457개이며, 매 회차 36개 영역에서 같은 개수씩 뽑습니다. 같은 개념의 문항이 한 페이지에 몰리지 않도록 흩어서 배치됩니다.</p>
  </div>
  <div class="card notice">
    <h3>주의사항</h3>
    <p>이 도구는 인성검사의 응답 형식을 연습하고 자신의 응답 패턴을 확인하기 위한 것입니다.</p>
    <p class="key">반드시 참고용으로만 사용하세요. 결과는 성격 진단이나 합격 예측이 아닙니다.</p>
    <p>결과는 실제 검사 결과와 아무런 관련이 없습니다. 여기서 응답이 많이 갈렸더라도 실제 검사에서는 그렇지 않을 수 있고, 그 반대도 마찬가지입니다.</p>
    <p>모든 문항은 자체 제작한 원본이며 실제 시험 문항이 아닙니다. 문항 분류는 성격 6요인 모델(HEXACO, Ashton &amp; Lee)의 구조를 참고했으나 공식 HEXACO-PI-R 검사와 무관하고, 문항의 신뢰도와 타당도를 통계적으로 검증하지 않았습니다.</p>
    <p>응답은 브라우저 안에서만 처리되며 어디에도 저장되지 않습니다. 결과를 남기려면 검사 후 닉네임과 PIN을 입력해 저장할 수 있습니다.</p>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" id="go">검사 시작</button>
    <button class="chip" id="hist" style="padding:13px 24px">지난 기록 보기</button>
  </div>`;
  let mode='full';
  const desc=()=>{
    const M=MODE[mode], p1=M.sets*3+M.tail;
    const pg=Math.ceil(M.sets/3)+(M.tail?1:0)+Math.ceil(M.p2/5);
    document.getElementById('mdesc').innerHTML=
      `<b>${M.total}문항</b> · 검사 I ${p1}문항 + 검사 II ${M.p2}문항 · ${pg}페이지 · ${M.mins}`
      + (mode==='quarter'?`<br><span class="fine">문항 수가 적어 영역별 응답이 3개씩만 뽑힙니다. 응답 패턴이 충분히 드러나지 않을 수 있습니다.</span>`:'');
  };
  desc();
  app.querySelectorAll('.chip[data-m]').forEach(c=>c.onclick=()=>{
    mode=c.dataset.m;
    app.querySelectorAll('.chip[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===c)));
    desc();
  });
  document.getElementById('go').onclick=()=>start(mode);
  document.getElementById('hist').onclick=()=>historyLogin();
}

/* ---------- 검사 시작 ---------- */
function start(mode){
  S=buildExam(mode);
  foot.hidden=false;
  render();
}

/* ---------- 페이지 이동과 시간 제한 ---------- */

// 다음 버튼은 그 페이지 응답을 모두 채워야 눌린다.
// 다만 시간이 다 되면 미응답인 채로 그냥 넘어간다. 실제 검사와 같은 방식이다.
function complete(){
  const p=S.pages[S.i], a=S.ans[S.i];
  if(p.t===0) return true;
  if(!a) return false;
  if(p.t===1) return a.every(s=>s.v.every(v=>v!==null)&&s.near!==null&&s.far!==null);
  return a.every(v=>v!==null);
}
function startTimer(){
  clearInterval(tick);
  const p=S.pages[S.i], g=document.getElementById('gauge'), f=document.getElementById('gfill');
  if(p.t===0){g.style.visibility='hidden';return;}
  g.style.visibility='visible'; S.left=p.limit;
  f.style.transition='none'; f.style.width='100%'; void f.offsetWidth;
  f.style.transition='width .95s linear'; g.classList.remove('low');
  tick=setInterval(()=>{
    S.left--; f.style.width=Math.max(0,S.left/p.limit*100)+'%';
    if(S.left<=p.limit*0.25) g.classList.add('low');
    if(S.left<=0){clearInterval(tick);go(true);}
  },1000);
}
function go(auto){
  if(!auto&&!complete()){
    const w=document.getElementById('warn');
    w.textContent='응답하지 않은 항목이 있습니다'; w.style.opacity='1';
    clearTimeout(S.wt); S.wt=setTimeout(()=>w.style.opacity='0',2200);
    return;
  }
  clearInterval(tick);
  if(S.i>=S.pages.length-1) return report();
  S.i++; render();
}

/* ---------- 문항 화면 ---------- */

function render(){
  const p=S.pages[S.i];
  window.scrollTo(0,0);
  const n1=S.pages.filter(x=>x.t===1).length, n2=S.pages.filter(x=>x.t===2).length;

  if(p.t===0){
    app.innerHTML=`
    <div class="top"><div class="t">인성검사 I 종료</div><div class="m">BREAK</div></div>
    <div class="card" style="padding:44px 24px;text-align:center">
      <h2 style="font-size:22px">이제 인성검사 II가 시작됩니다</h2>
      <p class="lead" style="margin:10px auto 0;max-width:520px">잠시 휴식을 취한 후 다음 검사를 준비해 주세요.<br>
      인성검사 II는 <b>한 페이지에 5문항, 페이지당 20초</b>로 진행됩니다.</p>
      <p class="fine" style="margin-top:18px">준비되면 다음 버튼을 누르세요. 이 화면에는 시간 제한이 없습니다.</p>
    </div>`;
    document.getElementById('flab').textContent='휴식';
    document.getElementById('fcnt').textContent='';
    startTimer(); app.onclick=null; return;
  }

  const a=S.ans[S.i]||(S.ans[S.i]= p.t===1
    ? p.sets.map(s=>({v:s.map(()=>null),near:null,far:null}))
    : p.items.map(()=>null));

  if(p.t===1){
    app.innerHTML=`
    <div class="top"><div class="t">인성검사 I</div><div class="m">${S.i+1} / ${n1} 페이지</div></div>
    <div class="instr"><span>각 문장이 자신과 얼마나 가까운지 <b>응답 1</b>에 표시하고, 세트마다 가장 가까운 것과 가장 먼 것을 <b>응답 2</b>에 하나씩 고르세요.</span><b style="white-space:nowrap">80초</b></div>
    <div class="grid">
      <div class="ghead">
        <div>문항</div>
        <div>응답 1<div class="sub"><span>매우 아니다</span><span>매우 그렇다</span></div></div>
        <div>응답 2<div class="sub"><span>가깝다</span><span>멀다</span></div></div>
      </div>
      ${p.sets.map((set,si)=>`<div class="set"><div class="setno">SET ${si+1}</div>
        ${set.map((q,qi)=>`<div class="row">
          <div class="q">${q[0]}</div>
          <div class="a1" data-s="${si}" data-q="${qi}">
            ${[1,2,3,4,5,6,7].map(v=>`<button class="bx" data-v="${v}" aria-pressed="${a[si].v[qi]===v}">${v}</button>`).join('')}
          </div>
          <div class="a2">
            <button class="ml" data-s="${si}" data-k="near" data-q="${qi}" aria-pressed="${a[si].near===qi}">가깝다</button>
            <button class="ml far" data-s="${si}" data-k="far" data-q="${qi}" aria-pressed="${a[si].far===qi}">멀다</button>
          </div></div>`).join('')}</div>`).join('')}
    </div>`;
  } else {
    const base=S.pages.slice(0,S.i).filter(x=>x.t===2).reduce((s,x)=>s+x.items.length,0);
    app.innerHTML=`
    <div class="top"><div class="t">인성검사 II</div><div class="m">${S.i-n1} / ${n2} 페이지</div></div>
    <div class="instr"><span>각 문장이 자신과 가까운 정도를 하나씩 고르세요.</span><b style="white-space:nowrap">20초</b></div>
    ${p.items.map((q,qi)=>`<div class="q2">
      <div class="q">${q[0]}</div>
      <div class="a" data-q="${qi}">
        ${L4.map((l,li)=>`<button class="op" data-v="${li+1}" aria-pressed="${a[qi]===li+1}">${l}</button>`).join('')}
      </div></div>`).join('')}`;
  }

  document.getElementById('flab').textContent = p.t===1?'인성검사 I':'인성검사 II';
  document.getElementById('fcnt').textContent = p.t===1?(S.i+1)+' / '+n1:(S.i-n1)+' / '+n2;
  startTimer();

  app.onclick=e=>{
    const b=e.target.closest('.bx');
    if(b){const box=b.closest('.a1'),si=+box.dataset.s,qi=+box.dataset.q;
      a[si].v[qi]=+b.dataset.v;
      box.querySelectorAll('.bx').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));return;}
    const m=e.target.closest('.ml');
    if(m){const si=+m.dataset.s,k=m.dataset.k,qi=+m.dataset.q;
      if(a[si][k]===qi)a[si][k]=null;
      else{a[si][k]=qi; if(k==='near'&&a[si].far===qi)a[si].far=null; if(k==='far'&&a[si].near===qi)a[si].near=null;}
      app.querySelectorAll(`.ml[data-s="${si}"]`).forEach(x=>x.setAttribute('aria-pressed',String(a[si][x.dataset.k]===+x.dataset.q)));return;}
    const o=e.target.closest('.op');
    if(o){const box=o.closest('.a'),qi=+box.dataset.q;
      a[qi]=+o.dataset.v;
      box.querySelectorAll('.op').forEach(x=>x.setAttribute('aria-pressed',String(x===o)));}
  };
}
document.getElementById('fnext').onclick=()=>go(false);

/* ========== 리포트 데이터 구성 ========== */

// score(S)에서 나온 결과를 직렬화 가능한 단순 객체로 변환한다.
// 서버에 저장할 때와 리포트를 다시 그릴 때 모두 이 형태를 쓴다.
function buildReportData(S){
  const sc=score(S);
  const pairs=sc.pairs.map(p=>({
    aText:p.a.q[0], aVal:p.a.v,
    bText:p.b.q[0], bVal:p.b.v,
    part:p.part, cl:p.cl, d:p.d
  }));
  return {
    mode:S.mode,
    tot:sc.tot, ansN:sc.ansN, miss:sc.miss,
    stab:sc.stab, splitN:sc.splitN, splitN2:sc.splitN2,
    sdScore:sc.sdScore, atFail:sc.atFail, atTotal:sc.atTotal||0, sdCount:sc.sdCount||0,
    mid:sc.mid, ext:sc.ext, dist:sc.dist,
    prof:sc.prof, ipsHit:sc.ipsHit, ipsTot:sc.ipsTot,
    elapsed:sc.elapsed,
    pairs:pairs,
    gapList:sc.gapList,
    shaky:sc.shaky,
    heat1:sc.heat1, heat2:sc.heat2
  };
}

/* ========== 조언 생성 ========== */

function buildTips(d){
  const tips=[];
  if(d.mid!=null&&d.mid>35) tips.push(`검사 I에서 중앙값 4를 ${d.mid}% 골랐습니다. 중앙에 몰리면 문항 간 차이가 줄어 같은 개념을 물었을 때의 응답 폭이 좁아집니다.`);
  if(d.ext!=null&&d.ext<10) tips.push(`양 끝(1·7) 응답이 ${d.ext}%입니다. 확실한 문항에서도 중간값을 쓰면 응답의 방향이 흐려집니다.`);
  if(d.miss>0) tips.push(`${d.miss}문항이 미응답으로 남았습니다. 페이지당 제한 시간 안에 다 채우지 못한 구간이 있습니다.`);
  if(d.sdScore!=null&&d.sdScore>=62) tips.push(`"한 번도 없다" 류 문항에 동의한 정도가 ${d.sdScore}입니다. 이런 문항이 많이 섞여 있고, 여기에 높게 답할수록 나머지 응답도 후하게 매겼을 가능성이 커집니다.`);
  if(d.atFail>0) tips.push(`사실상 성립하기 어려운 내용의 문항 ${d.atFail}개에 긍정으로 답했습니다. 문항을 끝까지 읽지 않고 넘어간 구간이 있는지 확인해 보세요.`);
  if(d.stab!=null&&d.stab>=85&&d.sdScore!=null&&d.sdScore>=70) tips.push(`응답이 매우 일관되게 모여 있으면서 동시에 과장 응답 지표가 높습니다. 문항마다 바람직해 보이는 쪽을 고르면 일관성 자체는 높게 나오지만, 그 일관성은 실제 성향이 아니라 응답 방식에서 나온 것일 수 있습니다.`);
  if(d.gapList&&d.gapList.length&&d.gapList[0].gap>=30) tips.push(`직접 묻는 문항과 조건이 붙은 문항의 응답 차이가 가장 큰 영역은 ${d.gapList[0].name}(${d.gapList[0].gap}점)입니다.`);
  if(d.shaky) d.shaky.forEach(([cl,n])=>tips.push(`${CL[cl]} 영역에서 응답이 갈린 문항 조합이 ${n}건입니다.`));
  return tips;
}

/* ========== 리포트 렌더링 (공용) ========== */

// opts: { showSave:bool, backTarget:'intro'|'list' }
function renderReport(d, opts){
  clearInterval(tick); foot.hidden=true; window.scrollTo(0,0);

  const mm=s=>Math.floor(s/60)+'분 '+(s%60)+'초';
  const modeLabel=MODE[d.mode]?MODE[d.mode].label:d.mode;
  const dist=d.dist||[];
  const d7=dist.reduce((a,b)=>a+b,0);
  const tips=buildTips(d);
  const pairs=d.pairs||[];
  const gapList=d.gapList||[];
  const prof=d.prof||[];

  // 히트맵
  const cell=(c,mx)=>{
    const o=c===0?0:0.18+c/mx*0.72;
    return `<div class="hcell" style="background:rgba(35,64,122,${o.toFixed(2)})" title="${c}회"></div>`;
  };
  const heatTable=(data,max)=>{
    if(!data||!data.length) return '<p class="fine">데이터 없음</p>';
    const mx=Math.max(1,...data.flatMap(g=>[...g.counts,...g.rows.flatMap(r=>r.counts)]));
    return `<div class="heat" style="--cols:${max}">
      <div class="hhead"><span></span>${Array.from({length:max},(_,i)=>`<span>${i+1}</span>`).join('')}<span></span></div>
      ${data.map(g=>`
        <div class="hrow hax"><span class="hname">${g.name}</span>
          ${g.counts.map(c=>cell(c,mx)).join('')}<span class="hn">${g.n}</span></div>
        ${g.rows.map(r=>`<div class="hrow hsub"><span class="hname">${r.name}</span>
          ${r.counts.map(c=>cell(c,mx)).join('')}<span class="hn">${r.n}</span></div>`).join('')}
      `).join('')}
    </div>`;
  };
  const heatI=heatTable(d.heat1,7), heatII=heatTable(d.heat2,4);

  app.innerHTML=`
  <div class="top"><div class="t">응답 리포트</div><div class="m">${modeLabel}</div></div>

  <div class="rline">이 결과는 실제 검사 결과를 예측하지 않습니다. 응답 패턴을 확인하는 참고 자료로만 사용하세요.</div>

  <div class="card">
    <h3>이번 응답 요약</h3>
    <p class="lead" style="margin-bottom:14px">
      ${d.tot}문항 중 ${d.ansN}문항 응답 · 소요 ${mm(d.elapsed)}<br>
      같은 개념을 다르게 물은 문항 조합에서 <b>응답이 갈린 경우가 ${pairs.length}건</b> 나왔습니다.
    </p>
    <div class="sum">
      <div class="su"><div class="k">응답 안정도</div><div class="v">${d.stab??'—'}</div>
        <div class="d">같은 개념 문항끼리 응답이 얼마나 모여 있는지</div></div>
      <div class="su"><div class="k">갈린 문항 · 검사 I</div><div class="v">${d.splitN}</div>
        <div class="d">7점 척도에서 3단계 이상 벌어진 조합</div></div>
      <div class="su"><div class="k">갈린 문항 · 검사 II</div><div class="v">${d.splitN2}</div>
        <div class="d">4단계 응답에서 2단계 이상 벌어진 조합</div></div>
      <div class="su"><div class="k">미응답</div><div class="v">${d.miss}</div>
        <div class="d">전체 ${d.tot}문항 중</div></div>
      ${d.sdScore!=null?`<div class="su"><div class="k">과장 응답</div><div class="v">${d.sdScore}</div>
        <div class="d">"한 번도 없다" 류 ${d.sdCount||''}문항 평균</div></div>`:''}
      ${d.atTotal?`<div class="su"><div class="k">주의력 문항</div><div class="v">${d.atTotal-d.atFail}/${d.atTotal}</div>
        <div class="d">성립하기 어려운 내용에 부정으로 답한 수</div></div>`:''}
      ${d.mid!=null?`<div class="su"><div class="k">중앙값 비율</div><div class="v">${d.mid}%</div>
        <div class="d">검사 I에서 4를 고른 비율</div></div>`:''}
      ${d.ipsTot?`<div class="su"><div class="k">강제선택 일치</div><div class="v">${Math.round(d.ipsHit/d.ipsTot*100)}%</div>
        <div class="d">척도 응답과 가깝다·멀다 선택이 맞은 세트</div></div>`:''}
    </div>
  </div>

  <div class="card">
    <h3>응답 분포</h3>
    <p class="fine" style="margin-bottom:12px">가로는 응답값, 세로는 성향 영역입니다. 많이 고른 칸일수록 진하게 표시됩니다. 한 칸에 몰려 있으면 그 영역에서 일관되게 답한 것이고, 여러 칸에 퍼져 있으면 문항에 따라 응답이 달라진 것입니다.</p>
    <div class="tabs">
      <button class="tab" data-h="1" aria-pressed="true">검사 I</button>
      <button class="tab" data-h="2" aria-pressed="false">검사 II</button>
      <button class="tab expand" id="hx" aria-pressed="false">자세히 보기</button>
    </div>
    <div id="heat1">${heatI}</div>
    <div id="heat2" hidden>${heatII}</div>
  </div>

  ${pairs.length?`<div class="card">
    <h3>응답이 갈린 문항</h3>
    <p class="fine" style="margin-bottom:10px">같은 개념을 다르게 물었는데 응답이 벌어진 조합입니다. 검사 I은 3단계 이상, 검사 II는 2단계 이상 벌어진 경우를 모았습니다. 총 ${pairs.length}건이며 벌어진 정도가 큰 순입니다.</p>
    <div class="scrolllist">
    ${pairs.map(p=>`
      <div class="item hard">
        <div>"${p.aText}" <span class="ans">${p.part===1?p.aVal+' / 7':L4[p.aVal-1]}</span></div>
        <div>"${p.bText}" <span class="ans">${p.part===1?p.bVal+' / 7':L4[p.bVal-1]}</span></div>
        <div class="meta">${CL[p.cl]} · 검사 ${p.part===1?'I':'II'} · ${p.d}단계 차이</div>
      </div>`).join('')}
    </div>
  </div>`:`<div class="card"><h3>응답이 갈린 문항</h3>
    <p class="lead" style="margin:0">기준을 넘는 차이가 발견되지 않았습니다.</p></div>`}

  ${gapList.length?`<div class="card">
    <h3>조건이 붙었을 때의 차이</h3>
    <p class="fine" style="margin-bottom:8px">같은 영역에서 직접 묻는 문항과 "아무도 모른다면", "다들 그렇게 한다면" 같은 조건이 붙은 문항의 응답 평균 차이입니다. 문항 수가 많지 않아 20점 안팎의 차이는 흔하게 나타납니다.</p>
    <table><thead><tr><th>영역</th><th style="text-align:right">직접</th><th style="text-align:right">조건</th><th style="text-align:right">차이</th></tr></thead>
    <tbody>${gapList.map(g=>`<tr><td>${g.name}</td><td class="n">${g.md}</td><td class="n">${g.mc}</td><td class="n">${g.gap>0?'+':''}${g.gap}</td></tr>`).join('')}</tbody></table>
  </div>`:''}

  ${tips.length?`<div class="card">
    <h3>이번 응답에서 관찰된 것</h3>
    <ul>${tips.map(t=>`<li>${t}</li>`).join('')}</ul>
  </div>`:''}

  <div class="card">
    <h3>영역별 응답 경향 (참고용)</h3>
    ${prof.map(p=>`<div class="bar-row"><span>${p.name}</span>
      <div class="bar"><i style="width:${p.v??0}%"></i></div>
      <span class="bar-val">${p.v??'—'}</span></div>`).join('')}
    <p class="fine" style="margin-top:12px">이 값은 응답이 갈린 위치를 찾기 위한 중간 계산이며, 검증된 성격 점수가 아닙니다. 높고 낮음에 의미를 두지 마세요.</p>
  </div>

  ${d7?`<div class="card"><h3>검사 I 응답 분포</h3>
    <div class="hist">${dist.map(v=>{const m=Math.max(...dist)||1;return `<div style="height:${Math.max(3,v/m*100)}%"><u>${v}</u></div>`}).join('')}</div>
    <div class="hist-x">${[1,2,3,4,5,6,7].map(n=>`<span>${n}</span>`).join('')}</div>
  </div>`:''}

  ${opts.showSave?`
  <div class="card" id="saveCard">
    <h3>결과 저장</h3>
    <p class="fine" style="margin-bottom:10px">닉네임과 PIN을 입력하면 결과를 저장하고 나중에 다시 볼 수 있습니다. 처음 저장하면 자동으로 등록됩니다.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <label class="fine" style="display:block;margin-bottom:3px">닉네임 (20자 이내)</label>
        <input id="saveNick" type="text" maxlength="20" style="border:1.4px solid var(--rule);padding:9px 12px;font-size:14px;font-family:inherit;width:160px" placeholder="닉네임">
      </div>
      <div>
        <label class="fine" style="display:block;margin-bottom:3px">PIN (4~8자리)</label>
        <input id="savePin" type="password" maxlength="8" style="border:1.4px solid var(--rule);padding:9px 12px;font-size:14px;font-family:inherit;width:120px" placeholder="PIN">
      </div>
      <button class="btn" id="saveBtn" style="padding:10px 22px">저장</button>
    </div>
    <p class="fine" id="saveMsg" style="margin-top:8px;color:var(--stamp)"></p>
  </div>`:''}

  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" id="again">${opts.backTarget==='list'?'목록으로':'다시 응시'}</button>
    <button class="chip" id="pr" style="padding:13px 24px">리포트 인쇄 / PDF 저장</button>
  </div>`;

  // 히트맵 탭과 펼치기
  const hw=document.querySelector('.tabs');
  if(hw){
    hw.addEventListener('click',e=>{
      const b=e.target.closest('.tab'); if(!b)return;
      if(b.id==='hx'){
        const on=b.getAttribute('aria-pressed')!=='true';
        b.setAttribute('aria-pressed',String(on));
        b.textContent=on?'접기':'자세히 보기';
        document.querySelectorAll('.heat').forEach(h=>h.classList.toggle('open',on));
        return;
      }
      hw.querySelectorAll('.tab:not(.expand)').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      document.getElementById('heat1').hidden = b.dataset.h!=='1';
      document.getElementById('heat2').hidden = b.dataset.h!=='2';
    });
  }

  // 저장 버튼
  if(opts.showSave){
    const saveBtn=document.getElementById('saveBtn');
    const saveMsg=document.getElementById('saveMsg');
    // 이전에 이력 조회에서 인증했으면 자동 채움
    if(_creds){
      document.getElementById('saveNick').value=_creds.nickname;
      document.getElementById('savePin').value=_creds.pin;
    }
    saveBtn.onclick=async()=>{
      const nickname=document.getElementById('saveNick').value.trim();
      const pin=document.getElementById('savePin').value;
      if(!nickname||nickname.length>20){saveMsg.textContent='닉네임을 입력해 주세요 (20자 이내)';return;}
      if(pin.length<4||pin.length>8){saveMsg.textContent='PIN은 4~8자리로 입력해 주세요';return;}
      saveBtn.disabled=true; saveBtn.textContent='저장 중…';
      try{
        const result={
          mode:d.mode, elapsed:d.elapsed, tot:d.tot, ansN:d.ansN, miss:d.miss,
          stab:d.stab, splitN:d.splitN, splitN2:d.splitN2,
          sdScore:d.sdScore, atFail:d.atFail, mid:d.mid, ext:d.ext,
          dist:d.dist, prof:d.prof, ipsHit:d.ipsHit, ipsTot:d.ipsTot,
          raw:{pairs:d.pairs, gapList:d.gapList, shaky:d.shaky, heat1:d.heat1, heat2:d.heat2, atTotal:d.atTotal, sdCount:d.sdCount}
        };
        const res=await API.save(nickname,pin,result);
        if(res.error){saveMsg.textContent=res.error;saveBtn.disabled=false;saveBtn.textContent='저장';return;}
        _creds={nickname,pin};
        document.getElementById('saveCard').innerHTML=`
          <h3>저장 완료</h3>
          <p class="lead" style="margin:0">결과가 저장되었습니다. 시작 화면의 "지난 기록 보기"에서 확인할 수 있습니다.</p>`;
      }catch(e){
        saveMsg.textContent='서버에 연결할 수 없습니다';
        saveBtn.disabled=false; saveBtn.textContent='저장';
      }
    };
  }

  // 하단 버튼
  document.getElementById('again').onclick=()=>{
    if(opts.backTarget==='list'&&_creds) historyList(_creds.nickname,_creds.pin);
    else intro();
  };
  document.getElementById('pr').onclick=()=>window.print();
}

/* ---------- 리포트 (검사 직후) ---------- */
function report(){
  const d=buildReportData(S);
  renderReport(d, {showSave:true, backTarget:'intro'});
}

/* ========== 이력 조회 ========== */

function historyLogin(){
  foot.hidden=true;
  app.innerHTML=`
  <div class="top"><div class="t">지난 기록</div><div class="m">HISTORY</div></div>
  <div class="card">
    <h3>로그인</h3>
    <p class="fine" style="margin-bottom:12px">검사 결과를 저장할 때 사용한 닉네임과 PIN을 입력하세요.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <label class="fine" style="display:block;margin-bottom:3px">닉네임</label>
        <input id="histNick" type="text" maxlength="20" style="border:1.4px solid var(--rule);padding:9px 12px;font-size:14px;font-family:inherit;width:160px" placeholder="닉네임">
      </div>
      <div>
        <label class="fine" style="display:block;margin-bottom:3px">PIN</label>
        <input id="histPin" type="password" maxlength="8" style="border:1.4px solid var(--rule);padding:9px 12px;font-size:14px;font-family:inherit;width:120px" placeholder="PIN">
      </div>
      <button class="btn" id="histGo" style="padding:10px 22px">조회</button>
    </div>
    <p class="fine" id="histMsg" style="margin-top:8px;color:var(--stamp)"></p>
  </div>
  <button class="chip" id="histBack" style="padding:13px 24px">돌아가기</button>`;

  if(_creds){
    document.getElementById('histNick').value=_creds.nickname;
    document.getElementById('histPin').value=_creds.pin;
  }

  document.getElementById('histGo').onclick=async()=>{
    const nickname=document.getElementById('histNick').value.trim();
    const pin=document.getElementById('histPin').value;
    if(!nickname||!pin){document.getElementById('histMsg').textContent='닉네임과 PIN을 입력해 주세요';return;}
    const btn=document.getElementById('histGo');
    btn.disabled=true; btn.textContent='조회 중…';
    try{
      const res=await API.list(nickname,pin);
      if(res.error){document.getElementById('histMsg').textContent=res.error;btn.disabled=false;btn.textContent='조회';return;}
      _creds={nickname,pin};
      const items=(res.items||[]).filter(i=>i.sk!=='PROFILE');
      historyList(nickname,pin,items);
    }catch(e){
      document.getElementById('histMsg').textContent='서버에 연결할 수 없습니다';
      btn.disabled=false; btn.textContent='조회';
    }
  };
  document.getElementById('histBack').onclick=intro;
}

function historyList(nickname,pin,items){
  foot.hidden=true;
  const mm=s=>Math.floor(s/60)+'분 '+(s%60)+'초';
  const fmtDate=sk=>{
    try{
      const d=new Date(sk);
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }catch(e){return sk;}
  };

  if(!items||items.length===0){
    app.innerHTML=`
    <div class="top"><div class="t">지난 기록</div><div class="m">${nickname}</div></div>
    <div class="card">
      <p class="lead" style="margin:0">저장된 기록이 없습니다. 검사를 완료한 후 결과를 저장해 보세요.</p>
    </div>
    <button class="btn" id="histBack2">돌아가기</button>`;
    document.getElementById('histBack2').onclick=intro;
    return;
  }

  app.innerHTML=`
  <div class="top"><div class="t">지난 기록</div><div class="m">${nickname} · ${items.length}건</div></div>
  <p class="fine" style="margin-bottom:12px">기록을 클릭하면 상세 리포트를 볼 수 있습니다.</p>
  ${items.map((it,idx)=>`
    <div class="card" style="cursor:pointer;transition:border-color .15s" data-idx="${idx}"
         onmouseover="this.style.borderColor='var(--mark)'" onmouseout="this.style.borderColor='var(--rule)'">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-weight:700;font-size:15px">${fmtDate(it.sk)}</span>
        <span class="fine">${MODE[it.mode]?MODE[it.mode].label:it.mode}${it.elapsed?' · '+mm(it.elapsed):''}</span>
      </div>
      <div class="sum" style="gap:8px">
        <div class="su" style="padding:8px"><div class="k">안정도</div><div class="v" style="font-size:18px">${it.stab??'—'}</div></div>
        <div class="su" style="padding:8px"><div class="k">갈린 I</div><div class="v" style="font-size:18px">${it.splitN??'—'}</div></div>
        <div class="su" style="padding:8px"><div class="k">갈린 II</div><div class="v" style="font-size:18px">${it.splitN2??'—'}</div></div>
        <div class="su" style="padding:8px"><div class="k">미응답</div><div class="v" style="font-size:18px">${it.miss??0}</div></div>
      </div>
    </div>`).join('')}
  <button class="chip" id="histBack3" style="padding:13px 24px">돌아가기</button>`;

  // 카드 클릭 → 상세
  items.forEach((it,idx)=>{
    app.querySelector(`[data-idx="${idx}"]`).onclick=()=>historyDetail(nickname,pin,it.sk);
  });
  document.getElementById('histBack3').onclick=intro;
}

async function historyDetail(nickname,pin,sk){
  app.innerHTML=`
  <div class="top"><div class="t">기록 불러오는 중</div><div class="m">LOADING</div></div>
  <div class="card"><p class="lead" style="margin:0">잠시만 기다려 주세요…</p></div>`;
  try{
    const res=await API.detail(nickname,pin,sk);
    if(res.error){
      app.innerHTML=`
      <div class="top"><div class="t">오류</div><div class="m">ERROR</div></div>
      <div class="card"><p class="lead" style="margin:0">${res.error}</p></div>
      <button class="btn" id="errBack">돌아가기</button>`;
      document.getElementById('errBack').onclick=()=>historyList(nickname,pin);
      return;
    }
    const item=res.item;
    const raw=item.raw||{};
    const d={
      mode:item.mode, tot:item.tot, ansN:item.ansN, miss:item.miss,
      stab:item.stab, splitN:item.splitN, splitN2:item.splitN2,
      sdScore:item.sdScore, atFail:item.atFail,
      atTotal:raw.atTotal||0, sdCount:raw.sdCount||0,
      mid:item.mid, ext:item.ext, dist:item.dist,
      prof:item.prof, ipsHit:item.ipsHit, ipsTot:item.ipsTot,
      elapsed:item.elapsed,
      pairs:raw.pairs||[], gapList:raw.gapList||[], shaky:raw.shaky||[],
      heat1:raw.heat1||null, heat2:raw.heat2||null
    };
    renderReport(d, {showSave:false, backTarget:'list'});
  }catch(e){
    app.innerHTML=`
    <div class="top"><div class="t">오류</div><div class="m">ERROR</div></div>
    <div class="card"><p class="lead" style="margin:0">서버에 연결할 수 없습니다</p></div>
    <button class="btn" id="errBack2">돌아가기</button>`;
    document.getElementById('errBack2').onclick=()=>historyList(nickname,pin);
  }
}

intro();
