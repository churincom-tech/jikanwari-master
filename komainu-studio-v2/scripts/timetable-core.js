(function(global){
  'use strict';
  const App=global.TimetableApp;
  const now=()=>global.performance?performance.now():Date.now();
  // Generator checkpoints keep file:// use cancellable without a worker URL or network.
  function* searchOnce(state,count=3,options={}){
    const began=now(), validation=App.Validation.validateRequest(state), candidates=[],seen=new Set();
    let nodes=0,seed=Number(options.seed)||1;
    const finish=(status,exhausted=false)=>({status,exhausted,candidates,validation,generationErrors:validation.errors.map(x=>x.text),stats:{nodes,elapsedMs:Math.round(now()-began),seed,distinct:candidates.length}});
    if(validation.errors.length)return finish('invalid');
    const budget=options.timeLimitMs??(App.State.getClasses(state).length>=18?60000:App.State.getClasses(state).length>6?30000:15000);
    const deadline=began+budget, maxNodes=options.maxNodes??Infinity;
    const days=state.school.days,slots=App.State.getSlots(state),lessons=state.lessons,classes=App.State.getClasses(state),teachers=state.teachers;
    const C=new Map(classes.map((c,i)=>[c.id,i])),T=new Map(teachers.map((t,i)=>[t.id,i])),L=new Map(lessons.map((l,i)=>[l.id,i]));
    const roomTypes=[...new Set(state.rooms.map(r=>r.type))], R=new Map(roomTypes.map((r,i)=>[r,i])),caps=roomTypes.map(r=>App.Validation.getRoomCount(state,r));
    const n=slots.length,D=days.length,target=App.State.getClassDayTargets(state),lunch=state.school.lunchBreakAfterPeriod??4;
    const classGrid=Array.from({length:C.size},()=>new Int32Array(n).fill(-1)),teacherGrid=Array.from({length:T.size},()=>new Uint8Array(n)),roomGrid=roomTypes.map(()=>new Uint16Array(n));
    const slotIndex=new Map(slots.map((s,i)=>[`${s.day}-${s.period}`,i]));
    const groups=[...new Set(lessons.map(l=>JSON.stringify([l.classId,l.subject])))],groupMap=new Map(groups.map((g,i)=>[g,i]));
    const limits=groups.map(g=>Math.min(...lessons.filter(l=>JSON.stringify([l.classId,l.subject])===g).map(l=>l.sameDayLimit)));
    const dayCounts=groups.map(()=>new Uint8Array(D));
    const records=lessons.map((l,i)=>({l,i,c:C.get(l.classId),t:T.get(l.teacherId),r:R.get(l.roomType),g:groupMap.get(JSON.stringify([l.classId,l.subject])),size:App.State.getDoubleMode(l)==='required'?2:1,mode:App.State.getDoubleMode(l),remaining:l.weeklyCount,last:-1,domain:[]}));
    const fixedBySlot=new Map();
    const recordsByClass=classes.map((_,ci)=>records.filter(rec=>rec.c===ci));
    for(const rec of records){
      const teacher=teachers[rec.t];
      for(let s=0;s<n;s++){
        const slot=slots[s],di=days.indexOf(slot.day),end=target.get(`${rec.l.classId}|${slot.day}`),indices=[s];
        if(slot.period>end)continue;
        if(rec.size===2){if(slot.period>=end||slot.period===lunch)continue;indices.push(s+1);}
        if(indices.some(x=>!slots[x]||slots[x].day!==slot.day||teacher.unavailable.includes(`${slots[x].day}-${slots[x].period}`)||(teacher.partTime&&!(teacher.workingDays||[]).includes(slot.day))))continue;
        rec.domain.push({s,indices,di});
      }
    }
    function available(rec,p){
      if(dayCounts[rec.g][p.di]+p.indices.length>limits[rec.g])return false;
      for(const si of p.indices){
        if(classGrid[rec.c][si]!==-1||teacherGrid[rec.t][si]||roomGrid[rec.r][si]>=caps[rec.r])return false;
        const slot=slots[si];
        for(const delta of [-1,1]){const other=si+delta;if(!slots[other]||slots[other].day!==slot.day)continue;if(classGrid[rec.c][other]===rec.i&&(rec.mode==='none'||Math.min(slot.period,slots[other].period)===lunch))return false;}
      }
      return true;
    }
    function put(rec,p,sign){
      for(const si of p.indices){classGrid[rec.c][si]=sign===1?rec.i:-1;teacherGrid[rec.t][si]=sign===1?1:0;roomGrid[rec.r][si]+=sign;}
      dayCounts[rec.g][p.di]+=sign*p.indices.length;rec.remaining-=sign*p.indices.length;
    }
    // Required fixed pairs are request-validated; seed the occupancy a slot at a time.
    for(const f of state.fixedAssignments){
      const rec=records[L.get(f.lessonId)],si=slotIndex.get(`${f.day}-${f.period}`),p={s:si,indices:[si],di:days.indexOf(f.day)};
      if(!available(rec,p)){validation.errors.push({type:'error',text:'固定授業が日上限・担当・教室・連続条件と矛盾しています。',ref:f.id,fixTab:'fixed'});return finish('invalid');}
      put(rec,p,1);fixedBySlot.set(`${rec.c}:${si}`,f);
    }
    let stopped=false,hitLimit=false;
    function candidate(){
      const entries=[];
      for(let ci=0;ci<C.size;ci++)for(let si=0;si<n;si++){const li=classGrid[ci][si];if(li<0)continue;const l=lessons[li],f=fixedBySlot.get(`${ci}:${si}`);entries.push({id:`e-${ci}-${si}`,lessonId:l.id,classId:l.classId,subject:l.subject,teacherId:l.teacherId,roomType:l.roomType,day:slots[si].day,period:slots[si].period,fixed:Boolean(f),fixedId:f?f.id:''});}
      const c={id:`v2-${seed}-${candidates.length+1}`,name:`候補${String.fromCharCode(65+candidates.length)}`,entries,hardViolations:[],warnings:[],improvements:[],breakdown:{},score:0};
      c.hardViolations=App.Validation.validateCandidate(state,c);
      if(c.hardViolations.length)return;
      const key=App.V2.signature(c);if(seen.has(key))return;seen.add(key);Object.assign(c,App.Scoring.scoreCandidate(state,c));candidates.push(c);
    }
    function hash(i,s){let x=Math.imul(i+17,374761393)^Math.imul(s+23,668265263)^Math.imul(seed,1274126177);x=Math.imul(x^(x>>>13),1274126177);return (x^(x>>>16))>>>0;}
    function* dfs(){
      nodes++;
      if(now()>=deadline||nodes>maxNodes){hitLimit=true;return;}
      yield {nodes,elapsedMs:Math.round(now()-began),distinct:candidates.length};
      if(options.isCancelled?.()){stopped=true;return;}
      let choices=null,remainingTotal=0;
      const coverage=classes.map(()=>Array.from({length:n},()=>[]));
      for(const rec of records){
        if(rec.remaining===0)continue;remainingTotal+=rec.remaining;
        const possible=rec.domain.filter(p=>available(rec,p)),needed=rec.remaining/rec.size;
        if(possible.length<needed)return;
        const daily=new Array(D).fill(0);for(const p of possible)daily[p.di]++;
        let cap=0;for(let d=0;d<D;d++)cap+=Math.min(daily[d],Math.floor((limits[rec.g]-dayCounts[rec.g][d])/rec.size));
        if(cap<needed)return;
        for(const p of possible)for(const si of p.indices)coverage[rec.c][si].push({rec,p,urgency:needed/possible.length});
      }
      if(remainingTotal===0){candidate();return;}
      for(let ci=0;ci<C.size;ci++)for(let si=0;si<n;si++){
        if(classGrid[ci][si]!==-1||slots[si].period>target.get(`${classes[ci].id}|${slots[si].day}`))continue;
        const domain=coverage[ci][si];
        if(!domain.length)return;
        if(!choices||domain.length<choices.length)choices=domain;
      }
      choices.sort((a,b)=>b.urgency-a.urgency||b.rec.size-a.rec.size||hash(a.rec.i,a.p.s)-hash(b.rec.i,b.p.s));
      for(const {rec,p} of choices){put(rec,p,1);yield* dfs();put(rec,p,-1);if(candidates.length>=count||hitLimit||stopped)return;}
    }
    yield* dfs();
    candidates.sort((a,b)=>b.score-a.score);candidates.forEach((c,i)=>c.name=`候補${String.fromCharCode(65+i)}`);
    if(stopped){candidates.length=0;return finish('cancelled');}
    if(hitLimit)return finish(candidates.length?'partial':'limit');
    return finish(candidates.length>=count?'success':candidates.length?'complete':'unsatisfiable',candidates.length<count);
  }
  function* search(state,count=3,options={}){
    if(App.Validation.validateRequest(state).errors.length)return yield* searchOnce(state,count,options);
    if(options.maxNodes!==undefined)return yield* searchOnce(state,count,options);
    const began=now(),classes=App.State.getClasses(state).length,budget=options.timeLimitMs??(classes>=18?60000:classes>6?30000:15000),seed=Number(options.seed)||1;
    const pool=[],seen=new Set();let totalNodes=0,attempts=0,last;
    do{
      const remaining=Math.max(0,budget-(now()-began));
      const it=searchOnce(state,count,{...options,seed:seed+attempts*7919,timeLimitMs:Math.min(2000,remaining),maxNodes:20000});
      let step;
      do{step=it.next();if(!step.done)yield {...step.value,nodes:totalNodes+step.value.nodes,elapsedMs:Math.round(now()-began),distinct:pool.length+step.value.distinct};}while(!step.done);
      last=step.value;attempts++;totalNodes+=last.stats.nodes;
      for(const c of last.candidates){const key=App.V2.signature(c);if(!seen.has(key)){seen.add(key);pool.push(c);}}
      if(pool.length>=count||last.exhausted||['invalid','cancelled'].includes(last.status))break;
    }while(now()-began<budget);
    pool.sort((a,b)=>b.score-a.score);pool.splice(count);pool.forEach((c,i)=>{c.id=`v2-${seed}-${i+1}`;c.name=`候補${String.fromCharCode(65+i)}`;});
    const cancelled=last.status==='cancelled';
    return {...last,candidates:cancelled?[]:pool,status:cancelled?'cancelled':last.status==='invalid'?'invalid':pool.length>=count?'success':last.exhausted?(pool.length?'complete':'unsatisfiable'):(pool.length?'partial':'limit'),stats:{nodes:totalNodes,elapsedMs:Math.round(now()-began),seed,attempts,distinct:cancelled?0:pool.length}};
  }
  function generateCandidates(state,count=3,options={}){const it=search(state,count,options);let step;do{step=it.next();}while(!step.done);return step.value;}
  async function generateAsync(state,count=3,options={}){
    const it=search(state,count,options);let step,lastProgress=0;
    do{const until=now()+8;do{step=it.next();}while(!step.done&&now()<until);if(!step.done){if(now()-lastProgress>120){options.onProgress?.(step.value);lastProgress=now();}await new Promise(r=>setTimeout(r,0));}}while(!step.done);
    return step.value;
  }
  App.TimetableCore={generateCandidates,generateAsync,search,buildCandidate:(state,seed)=>generateCandidates(state,1,{seed}).candidates[0]};
})(globalThis);
