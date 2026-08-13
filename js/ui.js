// 화면 그리기와 사용자 조작
//
// 검사 진행 화면, 페이지 이동, 시간 제한, 리포트 출력을 담당한다.
// 계산은 전부 engine.js에 있고 여기서는 결과를 보여주기만 한다.

const app=document.getElementById('app'), foot=document.getElementById('foot');
let S=null, tick=null;

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
    <p>응답은 브라우저 안에서만 처리되며 어디에도 저장되지 않습니다.</p>
  </div>
  <button class="btn" id="go">검사 시작</button>`;
  let mode='full';
  const desc=()=>{
    const M=MODE[mode], p1=M.sets*3+M.tail;
    const pg=Math.ceil(M.sets/3)+(M.tail?1:0)+Math.ceil(M.p2/5);
    document.getElementById('mdesc').innerHTML=
      `<b>${M.total}문항</b> · 검사 I ${p1}문항 + 검사 II ${M.p2}문항 · ${pg}페이지 · ${M.mins}`
      + (mode==='quarter'?`<br><span class="fine">문항 수가 적어 영역별 응답이 3개씩만 뽑힙니다. 응답 패턴이 충분히 드러나지 않을 수 있습니다.</span>`:'');
  };
  desc();
  app.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{
    mode=c.dataset.m;
    app.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',String(x===c)));
    desc();
  });
  document.getElementById('go').onclick=()=>start(mode);
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

/* ---------- 리포트 ---------- */
function report(){
  clearInterval(tick); foot.hidden=true;

  const {tot,ansN,miss,hardN,mildN,pairs,stab,gapList,prof,shaky,spreadData,seq,
         sdScore,atFail,atTotal,sdCount,mid,ext,dist,ipsHit,ipsTot,elapsed}=score(S);
  const d7=dist.reduce((a,b)=>a+b,0);
  const mm=s=>Math.floor(s/60)+'분 '+(s%60)+'초';

  // 조언

  // 영역별 응답 산포도 — 흩어진 순으로 위에서부터
  const top=spreadData.slice(0,14);
  const W=560, ROW=22, PAD=132;
  const spreadSvg=`
  <svg viewBox="0 0 ${W+PAD+30} ${top.length*ROW+34}" style="width:100%;height:auto">
    <line x1="${PAD}" y1="22" x2="${PAD}" y2="${top.length*ROW+26}" stroke="var(--rule)"/>
    <line x1="${PAD+W}" y1="22" x2="${PAD+W}" y2="${top.length*ROW+26}" stroke="var(--rule)"/>
    <text x="${PAD}" y="14" font-size="10" fill="var(--ink3)" font-family="var(--mono)">낮음</text>
    <text x="${PAD+W}" y="14" font-size="10" fill="var(--ink3)" text-anchor="end" font-family="var(--mono)">높음</text>
    ${top.map((d,i)=>{
      const y=i*ROW+34;
      const lo=Math.min(...d.points), hi=Math.max(...d.points);
      const X=v=>PAD+v/100*W;
      return `
      <text x="${PAD-10}" y="${y+4}" font-size="11.5" fill="var(--ink2)" text-anchor="end">${d.name}</text>
      <line x1="${X(lo)}" y1="${y}" x2="${X(hi)}" y2="${y}" stroke="${d.sd>=28?'var(--stamp)':'var(--rule)'}" stroke-width="1.5"/>
      ${d.points.map(v=>`<circle cx="${X(v)}" cy="${y}" r="3.5" fill="${d.sd>=28?'var(--stamp)':'var(--mark)'}" fill-opacity="0.55"/>`).join('')}
      <text x="${PAD+W+8}" y="${y+4}" font-size="10.5" fill="var(--ink3)" font-family="var(--mono)">${Math.round(d.sd)}</text>`;
    }).join('')}
  </svg>`;

  // 모순이 검사 어디쯤에서 나왔는지
  const marks=pairs.map(p=>({x:(p.a.idx+p.b.idx)/2/seq*100, hard:p.level==='명확'}));
  const bins=Array.from({length:10},(_,i)=>marks.filter(m=>m.x>=i*10&&m.x<(i+1)*10).length);
  const maxBin=Math.max(...bins,1);
  const posSvg=`
  <svg viewBox="0 0 620 118" style="width:100%;height:auto">
    ${bins.map((b,i)=>`<rect x="${i*61+4}" y="${88-b/maxBin*72}" width="53" height="${Math.max(1,b/maxBin*72)}"
      fill="var(--mark)" fill-opacity="0.18"/>`).join('')}
    ${marks.map(m=>`<circle cx="${4+m.x/100*606}" cy="${52+(Math.random()-0.5)*44}" r="4"
      fill="${m.hard?'var(--stamp)':'var(--mark)'}" fill-opacity="${m.hard?0.75:0.4}"/>`).join('')}
    <line x1="4" y1="94" x2="610" y2="94" stroke="var(--rule)"/>
    <text x="4" y="110" font-size="10.5" fill="var(--ink3)" font-family="var(--mono)">검사 시작</text>
    <text x="307" y="110" font-size="10.5" fill="var(--ink3)" text-anchor="middle" font-family="var(--mono)">중반</text>
    <text x="610" y="110" font-size="10.5" fill="var(--ink3)" text-anchor="end" font-family="var(--mono)">검사 끝</text>
  </svg>`;
  const firstHalf=marks.filter(m=>m.x<50).length, lateHalf=marks.length-firstHalf;

  const tips=[];
  if(marks.length>=6&&lateHalf>=firstHalf*2) tips.push(`응답이 갈린 문항 ${marks.length}건 중 ${lateHalf}건이 후반부에 나왔습니다. 뒤로 갈수록 응답이 흔들린 구간이 있습니다.`);
  else if(marks.length>=6&&firstHalf>=lateHalf*2) tips.push(`응답이 갈린 문항 ${marks.length}건 중 ${firstHalf}건이 전반부에 몰려 있습니다. 초반에 기준을 잡는 데 시간이 걸린 것으로 보입니다.`);
  if(mid!==null&&mid>35) tips.push(`검사 I에서 중앙값 4를 ${mid}% 골랐습니다. 중앙에 몰리면 문항 간 차이가 줄어 같은 개념을 물었을 때의 응답 폭이 좁아집니다.`);
  if(ext!==null&&ext<10) tips.push(`양 끝(1·7) 응답이 ${ext}%입니다. 확실한 문항에서도 중간값을 쓰면 응답의 방향이 흐려집니다.`);
  if(miss>0) tips.push(`${miss}문항이 미응답으로 남았습니다. 페이지당 제한 시간 안에 다 채우지 못한 구간이 있습니다.`);
  if(sdScore!==null&&sdScore>=62) tips.push(`"한 번도 없다" 류 문항에 동의한 정도가 ${sdScore}입니다. 이런 문항이 많이 섞여 있고, 여기에 높게 답할수록 나머지 응답도 후하게 매겼을 가능성이 커집니다.`);
  if(atFail>0) tips.push(`사실상 성립하기 어려운 내용의 문항 ${atFail}개에 긍정으로 답했습니다. 문항을 끝까지 읽지 않고 넘어간 구간이 있는지 확인해 보세요.`);
  if(stab!==null&&stab>=85&&sdScore!==null&&sdScore>=70) tips.push(`응답이 매우 일관되게 모여 있으면서 동시에 과장 응답 지표가 높습니다. 문항마다 바람직해 보이는 쪽을 고르면 일관성 자체는 높게 나오지만, 그 일관성은 실제 성향이 아니라 응답 방식에서 나온 것일 수 있습니다.`);
  if(gapList.length&&gapList[0].gap>=30) tips.push(`직접 묻는 문항과 조건이 붙은 문항의 응답 차이가 가장 큰 영역은 ${gapList[0].name}(${gapList[0].gap}점)입니다.`);
  shaky.forEach(([cl,n])=>tips.push(`${CL[cl]} 영역에서 응답이 갈린 문항 조합이 ${n}건입니다.`));

  app.innerHTML=`
  <div class="top"><div class="t">응답 리포트</div><div class="m">${MODE[S.mode].label}</div></div>

  <div class="rline">이 결과는 실제 검사 결과를 예측하지 않습니다. 응답 패턴을 확인하는 참고 자료로만 사용하세요.</div>

  <div class="card">
    <h3>이번 응답 요약</h3>
    <p class="lead" style="margin-bottom:14px">
      ${tot}문항 중 ${ansN}문항 응답 · 소요 ${mm(elapsed)}<br>
      같은 개념을 다르게 물은 문항 조합에서 <b>명확한 차이 ${hardN}건, 경미한 차이 ${mildN}건</b>이 나왔습니다.
    </p>
    <div class="sum">
      <div class="su"><div class="k">응답 안정도</div><div class="v">${stab??'—'}</div>
        <div class="d">같은 개념 문항끼리 응답이 얼마나 모여 있는지</div></div>
      <div class="su"><div class="k">명확한 차이</div><div class="v">${hardN}</div>
        <div class="d">검사 I 4단계 이상, 검사 II 3단계 차이</div></div>
      <div class="su"><div class="k">경미한 차이</div><div class="v">${mildN}</div>
        <div class="d">검사 I 3단계, 검사 II 2단계 차이</div></div>
      <div class="su"><div class="k">미응답</div><div class="v">${miss}</div>
        <div class="d">전체 ${tot}문항 중</div></div>
      ${sdScore!==null?`<div class="su"><div class="k">과장 응답</div><div class="v">${sdScore}</div>
        <div class="d">"한 번도 없다" 류 ${sdCount}문항 평균</div></div>`:''}
      ${atTotal?`<div class="su"><div class="k">주의력 문항</div><div class="v">${atTotal-atFail}/${atTotal}</div>
        <div class="d">성립하기 어려운 내용에 부정으로 답한 수</div></div>`:''}
      ${mid!==null?`<div class="su"><div class="k">중앙값 비율</div><div class="v">${mid}%</div>
        <div class="d">검사 I에서 4를 고른 비율</div></div>`:''}
      ${ipsTot?`<div class="su"><div class="k">강제선택 일치</div><div class="v">${Math.round(ipsHit/ipsTot*100)}%</div>
        <div class="d">척도 응답과 가깝다·멀다 선택이 맞은 세트</div></div>`:''}
    </div>
  </div>

  <div class="card">
    <h3>영역별 응답 산포</h3>
    <p class="fine" style="margin-bottom:10px">같은 개념을 다르게 물은 문항들의 응답 위치입니다. 점이 모여 있을수록 그 영역에서 일관되게 답한 것이고, 넓게 퍼져 있을수록 문항에 따라 응답이 달라진 것입니다. 오른쪽 숫자는 흩어진 정도이며, 흩어짐이 큰 순으로 정렬했습니다.</p>
    ${spreadSvg}
  </div>

  ${marks.length?`<div class="card">
    <h3>응답이 갈린 지점</h3>
    <p class="fine" style="margin-bottom:10px">응답이 갈린 문항 조합이 검사의 어느 구간에서 나왔는지입니다. 붉은 점은 명확한 차이, 파란 점은 경미한 차이입니다. 뒤쪽에 몰려 있다면 후반으로 갈수록 응답이 흔들린 것입니다.</p>
    ${posSvg}
    <p class="fine" style="margin-top:6px">전반부 ${firstHalf}건 · 후반부 ${lateHalf}건</p>
  </div>`:''}

  ${pairs.length?`<div class="card">
    <h3>응답이 갈린 문항</h3>
    ${pairs.slice(0,12).map(p=>`
      <div class="item ${p.level==='명확'?'hard':''}">
        <div>“${p.a.q[0]}” <span class="ans">${p.a.part===1?p.a.v+' / 7':L4[p.a.v-1]}</span></div>
        <div>“${p.b.q[0]}” <span class="ans">${p.b.part===1?p.b.v+' / 7':L4[p.b.v-1]}</span></div>
        <div class="meta">${CL[p.cl]} · ${p.d}단계 차이 · ${p.level}</div>
      </div>`).join('')}
    ${pairs.length>12?`<p class="fine">이 외 ${pairs.length-12}건은 생략했습니다.</p>`:''}
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

  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" id="again">다시 응시</button>
    <button class="chip" id="pr" style="padding:13px 24px">리포트 인쇄 / PDF 저장</button>
  </div>`;

  document.getElementById('again').onclick=intro;
  document.getElementById('pr').onclick=()=>window.print();
}

intro();
