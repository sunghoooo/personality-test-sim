// 검사 구성과 채점
//
// 화면을 그리지 않는 순수 계산만 모아둔 파일이다.
// 문항을 뽑아 배치하는 buildExam()과, 응답을 지표로 바꾸는 score()가 전부다.
// 브라우저 없이도 실행할 수 있어 응답 패턴별 검증에 그대로 쓸 수 있다.

const L4=["아니다","약간 그렇다","대체로 그렇다","매우 그렇다"];
const V4=[0,50,75,100];
const T1=80, T2=20;
// 분량별 구성
//   k     영역 하나에서 뽑을 문항 수 (영역이 36개이므로 k*36이 성향 문항 수가 된다)
//   sets  검사 I의 3문장 세트 수
//   tail  마지막 페이지에 남는 짧은 세트의 문항 수
//   p2    검사 II 문항 수
//   sd/at 인상 관리 문항, 주의력 점검 문항 수
const MODE={
  full:{label:"풀 사이즈", k:12, sets:51, tail:2, p2:300, sd:18, at:5, total:455, mins:"약 44분"},
  half:{label:"하프 사이즈", k:6, sets:24, tail:2, p2:150, sd:9, at:3, total:224, mins:"약 22분"},
  quarter:{label:"쿼터 사이즈", k:4, sets:12, tail:2, p2:115, sd:7, at:3, total:153, mins:"약 14분"}
};

const sh=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
const ax=c=>c[0];

// 한 영역에서 k개를 뽑되 직접·행동·조건 유형을 번갈아, 방향(+/-)도 교대로 가져간다.
// 그냥 무작위로 뽑으면 어떤 영역은 조건형이 하나도 안 걸려 조건부 격차를 잴 수 없다.
function pick(list,k){
  const byT={D:[],B:[],C:[]};
  list.forEach(x=>byT[x[3]].push(x));
  Object.keys(byT).forEach(t=>{
    const p=sh(byT[t].filter(x=>x[2]===1)), n=sh(byT[t].filter(x=>x[2]===-1)), o=[];
    while(p.length||n.length){ if(p.length)o.push(p.shift()); if(n.length)o.push(n.shift()); }
    byT[t]=o;
  });
  const order=sh(['D','B','C']), out=[];
  while(out.length<k){
    let added=false;
    for(const t of order){
      if(out.length>=k) break;
      if(byT[t].length){ out.push(byT[t].shift()); added=true; }
    }
    if(!added) break;
  }
  return out;
}

// 같은 영역 문항이 한 페이지에 몰리거나 연속된 페이지에 이어지지 않도록 흩어 놓는다.
// 비슷한 문항이 붙어 나오면 응시자가 함정임을 눈치채고 의식적으로 맞춰 답하게 되어
// 일관성 측정이 무의미해진다.
function spread(list, per, maxSame){
  const rem=list.slice(), pages=[]; let prev=new Set();
  while(rem.length){
    const page=[], cur={};
    for(let pass=0;pass<3&&page.length<per;pass++){
      for(let i=0;i<rem.length&&page.length<per;i++){
        const c=rem[i][1], n=cur[c]||0;
        if(pass===0&&(n>=maxSame||prev.has(c))) continue;
        if(pass===1&&n>=maxSame) continue;
        page.push(rem.splice(i,1)[0]); cur[c]=n+1; i--;
      }
    }
    pages.push(page); prev=new Set(page.map(x=>x[1]));
  }
  return pages;
}

// 검사 I의 한 세트는 서로 다른 축의 문장 3개로 만든다.
// 같은 축 문장끼리 묶으면 '가장 가까운 것'을 고르는 일이 사실상 불가능해진다.
function makeSets(pool,count){
  const p=sh(pool), out=[];
  while(out.length<count&&p.length>=3){
    const used=new Set(), s=[];
    for(let i=0;i<p.length&&s.length<3;i++){
      if(!used.has(ax(p[i][1]))){used.add(ax(p[i][1]));s.push(p.splice(i,1)[0]);i--;}
    }
    if(s.length<3) break;
    out.push(s);
  }
  return out;
}
function spreadSets(sets,per,maxSame){
  const rem=sets.slice(), pages=[]; let prev=new Set();
  while(rem.length){
    const page=[], cur={};
    for(let pass=0;pass<3&&page.length<per;pass++){
      for(let i=0;i<rem.length&&page.length<per;i++){
        const cs=rem[i].map(x=>x[1]);
        const bad0=cs.some(c=>(cur[c]||0)>=maxSame||prev.has(c));
        const bad1=cs.some(c=>(cur[c]||0)>=maxSame);
        if(pass===0&&bad0) continue;
        if(pass===1&&bad1) continue;
        const s=rem.splice(i,1)[0]; page.push(s);
        s.forEach(x=>cur[x[1]]=(cur[x[1]]||0)+1); i--;
      }
    }
    pages.push(page); prev=new Set(page.flat().map(x=>x[1]));
  }
  return pages;
}

function buildExam(mode){
  const M=MODE[mode];
  const sd=sh(Q.filter(x=>x[1]==='SD')).slice(0,M.sd);
  const at=sh(Q.filter(x=>x[1]==='AT')).slice(0,M.at);

  // 클러스터별로 같은 개수씩 뽑는다
  const byCl={};
  Q.filter(x=>x[1]!=='SD'&&x[1]!=='AT').forEach(x=>{(byCl[x[1]]=byCl[x[1]]||[]).push(x);});
  let pool=[];
  Object.values(byCl).forEach(list=>{pool=pool.concat(pick(list,M.k));});
  pool=sh(pool);

  const sets=makeSets(pool,M.sets);
  const used=new Set(sets.flat().map(x=>x[0]));

  const left=pool.filter(x=>!used.has(x[0]));
  const tail=[], tAx=new Set();
  for(let i=0;i<left.length&&tail.length<M.tail;i++){
    if(!tAx.has(ax(left[i][1]))){tAx.add(ax(left[i][1]));tail.push(left[i]);used.add(left[i][0]);}
  }

  const rest=pool.filter(x=>!used.has(x[0]));
  const p2=sh(rest.slice(0,M.p2-sd.length-at.length).concat(sd,at));

  const pages=[];
  spreadSets(sets,3,2).forEach(p=>pages.push({t:1,sets:p,limit:T1}));
  if(tail.length) pages.push({t:1,sets:[tail],limit:T1});
  pages.push({t:0});
  spread(p2,5,1).forEach(p=>pages.push({t:2,items:p,limit:T2}));

  return {mode,pages,i:0,ans:{},t0:Date.now()};
}

/* ---------- 채점 ---------- */

// 응답이 갈렸다고 보는 기준
//   검사 I(7점)  3단계 차이는 경미, 4단계 이상은 명확
//   검사 II(4단계) 2단계 차이는 경미, 3단계는 명확
// 척도 길이가 달라 같은 "2단계"가 뜻하는 폭이 다르므로 기준을 따로 둔다.
function score(S){
  const R=[];                    // 응답 레코드
  const dist=[0,0,0,0,0,0,0];
  let tot=0, miss=0, ipsHit=0, ipsTot=0, seq=0;

  S.pages.forEach((p,pi)=>{
    if(p.t===0) return;
    const a=S.ans[pi];
    if(p.t===1){
      p.sets.forEach((set,si)=>{
        set.forEach((q,qi)=>{
          tot++;
          const v=a?a[si].v[qi]:null;
          if(v==null){miss++;return;}
          dist[v-1]++;
          const raw=(v-1)/6*100;
          R.push({q,cl:q[1],dir:q[2],type:q[3],part:1,v,idx:++seq,step:q[2]===1?v:8-v,n:q[2]===1?raw:100-raw});
        });
        // 강제선택 일치 확인
        if(a&&a[si].near!=null&&a[si].far!=null){
          const vs=a[si].v;
          if(vs.every(x=>x!==null)){
            ipsTot++;
            const hi=Math.max(...vs), lo=Math.min(...vs);
            if(vs[a[si].near]===hi&&vs[a[si].far]===lo) ipsHit++;
          }
        }
      });
    } else {
      p.items.forEach((q,qi)=>{
        tot++;
        const v=a?a[qi]:null;
        if(v==null){miss++;return;}
        const raw=V4[v-1];
        R.push({q,cl:q[1],dir:q[2],type:q[3],part:2,v,idx:++seq,step:q[2]===1?v:5-v,n:q[2]===1?raw:100-raw});
      });
    }
  });

  const ansN=R.length;
  const norm=R.filter(r=>r.cl!=='SD'&&r.cl!=='AT');
  const sdR=R.filter(r=>r.cl==='SD');
  const atR=R.filter(r=>r.cl==='AT');

  // 클러스터별 집계
  const byCl={};
  norm.forEach(r=>{(byCl[r.cl]=byCl[r.cl]||[]).push(r);});

  // 모순 쌍
  const pairs=[];
  Object.entries(byCl).forEach(([cl,rs])=>{
    for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
      if(rs[i].part!==rs[j].part) continue;
      const d=Math.abs(rs[i].step-rs[j].step);
      const hard=rs[i].part===1?4:3, mild=rs[i].part===1?3:2;
      if(d>=mild) pairs.push({cl,a:rs[i],b:rs[j],d,level:d>=hard?'명확':'경미'});
    }
  });
  pairs.sort((x,y)=>y.d-x.d);
  const hardN=pairs.filter(x=>x.level==='명확').length;
  const mildN=pairs.filter(x=>x.level==='경미').length;

  // 응답 안정도 (클러스터 표준편차 평균)
  const sds=[];
  Object.values(byCl).forEach(rs=>{
    if(rs.length<4) return;
    const m=rs.reduce((s,r)=>s+r.n,0)/rs.length;
    sds.push(Math.sqrt(rs.reduce((s,r)=>s+(r.n-m)**2,0)/(rs.length-1)));
  });
  const stab=sds.length?Math.max(0,Math.round(100-(sds.reduce((a,b)=>a+b,0)/sds.length)*2.2)):null;

  // 영역별 응답 산포 — 같은 개념을 물은 문항들의 응답이 얼마나 모여 있는지
  const spreadData=Object.entries(byCl).map(([cl,rs])=>{
    const m=rs.reduce((s,r)=>s+r.n,0)/rs.length;
    const sd=rs.length>1?Math.sqrt(rs.reduce((s,r)=>s+(r.n-m)**2,0)/(rs.length-1)):0;
    return {cl,name:CL[cl],ax:ax(cl),mean:m,sd,points:rs.map(r=>r.n)};
  }).sort((a,b)=>b.sd-a.sd);

  // 조건부 격차 (축 단위 — 클러스터 단위는 문항이 적어 잡음이 큼)
  const byAxAll={};
  norm.forEach(r=>{const k=ax(r.cl);(byAxAll[k]=byAxAll[k]||[]).push(r);});
  const gapList=[];
  Object.entries(byAxAll).forEach(([k,rs])=>{
    const d=rs.filter(r=>r.type!=='C'), c=rs.filter(r=>r.type==='C');
    if(d.length<5||c.length<5) return;
    const md=d.reduce((s,r)=>s+r.n,0)/d.length, mc=c.reduce((s,r)=>s+r.n,0)/c.length;
    gapList.push({k,name:AXIS[k],gap:Math.round(md-mc),md:Math.round(md),mc:Math.round(mc),nd:d.length,nc:c.length});
  });
  gapList.sort((a,b)=>b.gap-a.gap);

  // 축별
  const byAx={};
  norm.forEach(r=>{const k=ax(r.cl);(byAx[k]=byAx[k]||[]).push(r.n);});
  const prof=Object.keys(AXIS).map(k=>({k,name:AXIS[k],
    v:byAx[k]?Math.round(byAx[k].reduce((a,b)=>a+b,0)/byAx[k].length):null,n:byAx[k]?byAx[k].length:0}));

  // 흔들린 영역
  const clCount={};
  pairs.forEach(p=>clCount[p.cl]=(clCount[p.cl]||0)+1);
  const shaky=Object.entries(clCount).sort((a,b)=>b[1]-a[1]).slice(0,3);

  const sdScore=sdR.length?Math.round(sdR.reduce((s,r)=>s+r.n,0)/sdR.length):null;
  const atFail=atR.filter(r=>r.v>=(r.part===1?5:3)).length;
  const d7=dist.reduce((a,b)=>a+b,0);
  const mid=d7?Math.round(dist[3]/d7*100):null;
  const ext=d7?Math.round((dist[0]+dist[6])/d7*100):null;
  const elapsed=Math.round((Date.now()-S.t0)/1000);
  const mm=s=>Math.floor(s/60)+'분 '+(s%60)+'초';

  // 조언
  const tips=[];
  if(mid!==null&&mid>35) tips.push(`검사 I에서 중앙값 4를 ${mid}% 골랐습니다. 중앙에 몰리면 문항 간 차이가 줄어 같은 개념을 물었을 때의 응답 폭이 좁아집니다.`);
  if(ext!==null&&ext<10) tips.push(`양 끝(1·7) 응답이 ${ext}%입니다. 확실한 문항에서도 중간값을 쓰면 응답의 방향이 흐려집니다.`);
  if(miss>0) tips.push(`${miss}문항이 미응답으로 남았습니다. 페이지당 제한 시간 안에 다 채우지 못한 구간이 있습니다.`);
  if(sdScore!==null&&sdScore>=62) tips.push(`"한 번도 없다" 류 문항에 동의한 정도가 ${sdScore}입니다. 이런 문항이 많이 섞여 있고, 여기에 높게 답할수록 나머지 응답도 후하게 매겼을 가능성이 커집니다.`);
  if(atFail>0) tips.push(`사실상 성립하기 어려운 내용의 문항 ${atFail}개에 긍정으로 답했습니다. 문항을 끝까지 읽지 않고 넘어간 구간이 있는지 확인해 보세요.`);
  if(stab!==null&&stab>=85&&sdScore!==null&&sdScore>=70) tips.push(`응답이 매우 일관되게 모여 있으면서 동시에 과장 응답 지표가 높습니다. 문항마다 바람직해 보이는 쪽을 고르면 일관성 자체는 높게 나오지만, 그 일관성은 실제 성향이 아니라 응답 방식에서 나온 것일 수 있습니다.`);
  if(gapList.length&&gapList[0].gap>=30) tips.push(`직접 묻는 문항과 조건이 붙은 문항의 응답 차이가 가장 큰 영역은 ${gapList[0].name}(${gapList[0].gap}점)입니다.`);
  shaky.forEach(([cl,n])=>tips.push(`${CL[cl]} 영역에서 응답이 갈린 문항 조합이 ${n}건입니다.`));


  return {tot,ansN,miss,hardN,mildN,pairs,stab,gapList,prof,shaky,spreadData,seq,
          sdScore,atFail,atTotal:atR.length,sdCount:sdR.length,
          mid,ext,dist,ipsHit,ipsTot,elapsed:Math.round((Date.now()-S.t0)/1000)};
}
