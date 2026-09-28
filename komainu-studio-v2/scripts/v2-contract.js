(function(global){
  'use strict';
  const App=global.TimetableApp, legacyRequest=App.Validation.validateRequest, legacyCandidate=App.Validation.validateCandidate;
  const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function structuralErrors(s){
    const out=[], add=(text,ref,fixTab)=>out.push({type:'error',text,ref,fixTab});
    if(!plain(s)||!plain(s.school)){add('学校情報の形式が正しくありません。','school','school');return out;}
    const school=s.school;
    if(!Array.isArray(school.days)||!school.days.length||school.days.some(d=>!App.Constants.ALL_DAYS.includes(d))||new Set(school.days).size!==school.days.length)add('曜日は重複なく1つ以上選択してください。','school.days','school');
    if(!integer(school.periodsPerDay,1,8)||!integer(school.gradeCount,1,9))add('時限数は1〜8、学年数は1〜9の整数にしてください。','school','school');
    if(!Array.isArray(school.classCounts)||school.classCounts.length<school.gradeCount||school.classCounts.slice(0,school.gradeCount).some(n=>!integer(n,1,12)))add('各学年のクラス数は1〜12の整数にしてください。','classes','school');
    if(school.lunchBreakAfterPeriod!==undefined&&!integer(school.lunchBreakAfterPeriod,1,8))add('給食前の最終時限は1〜8の整数にしてください。','school.lunchBreakAfterPeriod','school');
    if(school.dayPeriodLimits!==undefined&&(!plain(school.dayPeriodLimits)||(school.days||[]).some(d=>!integer(school.dayPeriodLimits[d],1,school.periodsPerDay))))add('曜日ごとの使用時限数は1〜最大時限数の整数にしてください。','school.dayPeriodLimits','school');
    for(const field of ['teachers','rooms','lessons','fixedAssignments']){
      if(!Array.isArray(s[field])||s[field].length>5000||s[field].some(x=>!plain(x))){add(`${field}の配列形式または件数が正しくありません。`,field,'school');continue;}
      const ids=s[field].map(x=>x.id);
      if(ids.some(x=>typeof x!=='string'||!x.trim()||x.length>200)||new Set(ids).size!==ids.length)add(`${field}に空のIDまたは重複IDがあります。`,field,field==='fixedAssignments'?'fixed':field);
    }
    if(out.length)return out;
    const classIds=new Set(App.State.getClasses(s).map(c=>c.id));
    s.teachers.forEach(t=>{
      if(typeof t.name!=='string'||(t.subjects!==undefined&&(!Array.isArray(t.subjects)||t.subjects.some(x=>typeof x!=='string')))||!Array.isArray(t.unavailable)||t.unavailable.some(x=>typeof x!=='string'||! /^[月火水木金土]-[1-8]$/.test(x))||(t.partTime!==undefined&&typeof t.partTime!=='boolean')||(t.workingDays!==undefined&&(!Array.isArray(t.workingDays)||t.workingDays.some(x=>!App.Constants.ALL_DAYS.includes(x)))))add('教員の氏名・教科・勤務枠の形式を確認してください。',t.id,'teachers');
    });
    s.rooms.forEach(r=>{if(typeof r.type!=='string'||!r.type.trim()||typeof r.name!=='string'||!integer(r.count,0,999))add('教室名・種別と室数（0〜999の整数）を確認してください。',r.id,'rooms');});
    s.lessons.forEach(l=>{
      if(!classIds.has(l.classId)||typeof l.subject!=='string'||!l.subject.trim()||typeof l.teacherId!=='string'||typeof l.roomType!=='string'||!integer(l.weeklyCount,1,48)||!integer(l.sameDayLimit,1,8)||(l.doubleMode!==undefined&&!['none','required','preferred'].includes(l.doubleMode)))add('授業のクラス・教科・担当・週時数（1〜48）・1日上限（1〜8）を確認してください。',l.id,'lessons');
      if(App.State.getDoubleMode(l)==='required'&&l.sameDayLimit<2)add(`${l.subject}: 連続必須の1日上限は2以上が必要です。`,l.id,'lessons');
    });
    s.fixedAssignments.forEach(f=>{if(!integer(f.period,1,8)||typeof f.day!=='string'||typeof f.lessonId!=='string')add('固定授業の曜日・時限・授業IDの形式を確認してください。',f.id,'fixed');});
    return out;
  }
  function validateRequest(s){
    const shape=structuralErrors(s);if(shape.length)return {errors:shape,warnings:[],info:[]};
    const v=legacyRequest(s), add=(text,ref,fixTab)=>v.errors.push({type:'error',text,ref,fixTab});
    const targets=App.State.getClassDayTargets(s), classes=App.State.getClasses(s);
    for(const l of s.lessons)if(App.Validation.getRoomCount(s,l.roomType)<1)add(`${l.subject}:「${l.roomType}」を1室以上登録してください。`,l.id,'rooms');
    for(const t of s.teachers){
      const need=s.lessons.filter(l=>l.teacherId===t.id).reduce((n,l)=>n+l.weeklyCount,0);
      const capacity=App.State.getSlots(s).filter(p=>(!t.partTime||(t.workingDays||[]).includes(p.day))&&!t.unavailable.includes(`${p.day}-${p.period}`)).length;
      if(need>capacity)add(`${t.name}: 担当は週${need}コマですが、勤務可能枠は${capacity}コマです。担当または勤務枠を見直してください。`,t.id,'teachers');
    }
    for(const c of classes){const need=s.lessons.filter(l=>l.classId===c.id).reduce((n,l)=>n+l.weeklyCount,0);const target=s.school.days.reduce((n,d)=>n+targets.get(`${c.id}|${d}`),0);if(need!==target)add(`${c.name}: 固定授業と日課の目標が必要時数に収まりません。固定時限・曜日上限を見直してください。`,c.id,'fixed');}
    for(const f of s.fixedAssignments){const l=s.lessons.find(x=>x.id===f.lessonId);if(!l)continue;const t=s.teachers.find(x=>x.id===l.teacherId);
      if(f.classId!==l.classId||(f.teacherId&&f.teacherId!==l.teacherId)||(f.roomType&&f.roomType!==l.roomType))add('固定授業の担当・クラス・教室が授業情報と一致していません。固定枠を設定し直してください。',f.id,'fixed');
      if(t&&t.partTime&&!(t.workingDays||[]).includes(f.day))add(`${t.name}: 勤務日でない${f.day}曜日に固定授業があります。`,f.id,'fixed');
    }
    return v;
  }
  function validateCandidate(s,c){
    if(!c||!Array.isArray(c.entries))return [{id:'H-003',text:'候補データの形式が不正です。',ref:''}];
    const out=legacyCandidate(s,c),add=(id,text,ref)=>out.push({id,text,ref}),byLesson=new Map(s.lessons.map(l=>[l.id,l])),byTeacher=new Map(s.teachers.map(t=>[t.id,t]));
    const rooms=new Map(),daily=new Map(),ids=new Set();
    for(const e of c.entries){
      const l=byLesson.get(e.lessonId);
      if(!l||e.classId!==l.classId||e.subject!==l.subject||e.teacherId!==l.teacherId||e.roomType!==l.roomType)add('H-003','配置の教科・担当・教室・クラスが授業情報と一致しません。',e.lessonId);
      if(typeof e.id!=='string'||!e.id||ids.has(e.id))add('H-006','配置IDが未設定または重複しています。',e.id);ids.add(e.id);
      const t=byTeacher.get(e.teacherId);
      if(!t||(t.partTime&&!(t.workingDays||[]).includes(e.day)))add('H-004','担当教員が未登録か、勤務日でない日に授業があります。',e.teacherId);
      const rk=JSON.stringify([e.roomType,e.day,e.period]);rooms.set(rk,(rooms.get(rk)||0)+1);
      if(e.roomType==='普通教室'&&rooms.get(rk)>App.Validation.getRoomCount(s,e.roomType))add('H-002','普通教室の同時利用数が登録室数を超えています。',e.roomType);
      if(l){const key=JSON.stringify([l.classId,l.subject,e.day]);daily.set(key,(daily.get(key)||0)+1);const limit=Math.min(...s.lessons.filter(x=>x.classId===l.classId&&x.subject===l.subject).map(x=>x.sameDayLimit));if(daily.get(key)>limit)add('DAY-LIMIT',`${l.subject}: 同じ日の授業数が1日上限${limit}を超えています。`,l.id);}
    }
    for(const f of s.fixedAssignments){const matches=c.entries.filter(e=>e.fixedId===f.id&&e.fixed===true&&e.lessonId===f.lessonId&&e.classId===f.classId&&e.day===f.day&&e.period===f.period);if(matches.length!==1)add('H-005','固定授業が欠落・変更・重複しています。',f.id);}
    for(const l of s.lessons)if(s.fixedAssignments.filter(f=>f.lessonId===l.id).length>l.weeklyCount)add('H-009','固定数が週時数を超えています。',l.id);
    return out;
  }
  function inputSnapshot(s){const result={};for(const k of ['school','teachers','rooms','lessons','fixedAssignments','curriculum','curriculumProfiles','activeCurriculumProfileId','constraints'])if(s[k]!==undefined)result[k]=s[k];return JSON.parse(JSON.stringify(result));}
  function fingerprint(s){return JSON.stringify(inputSnapshot(s));}
  function signature(c){return JSON.stringify(c.entries.map(e=>[e.lessonId,e.classId,e.day,e.period]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
  App.Validation.validateRequest=validateRequest;App.Validation.validateCandidate=validateCandidate;
  App.V2={structuralErrors,inputSnapshot,fingerprint,signature};
})(globalThis);
