(function(root){
 'use strict';
 const FIELDS=['item','value','unit','lower','upper','reference_unit','lower_inclusive','upper_inclusive'];
 const LABELS={within:'範囲内',high:'↑ 高値',low:'↓ 低値',unknown:'? 判定不可'};
 function number(raw){
  const s=String(raw??'').trim();if(!s)return null;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(s))throw Error('数値形式を確認してください');
  const n=Number(s),digits=s.split(/[eE]/)[0].replace(/[^0-9]/g,'').replace(/^0+/,'').replace(/0+$/,'');
  if(!Number.isFinite(n)||digits.length>15||(n===0&&/[1-9]/.test(s.split(/[eE]/)[0])))throw Error('扱える数値の精度・範囲を超えています');
  return n;
 }
 function inclusive(value){if(value===''||value===undefined||value===true||value==='true')return true;if(value===false||value==='false')return false;throw Error('境界条件はtrueまたはfalseで指定してください');}
 function compare(row,index=0){
  const r={id:'R'+(index+1),...Object.fromEntries(FIELDS.map(k=>[k,String(row[k]??'').trim()])),status:'unknown',reason:''};
  try{
   if(!r.item)throw Error('項目名がありません');
   if(r.item.length>100||FIELDS.some(k=>r[k].length>200))throw Error('入力が長すぎます');
   const v=number(r.value),lo=number(r.lower),hi=number(r.upper),li=inclusive(row.lower_inclusive),ui=inclusive(row.upper_inclusive);
   if(v===null)throw Error('測定値がありません');
   if(lo===null&&hi===null)throw Error('基準範囲がありません');
   if(!r.unit||!r.reference_unit||r.unit!==r.reference_unit)throw Error('測定値と基準範囲の単位が未入力、または一致しません');
   if(lo!==null&&hi!==null&&(lo>hi||(lo===hi&&(!li||!ui))))throw Error('基準範囲の上下限・境界条件が矛盾しています');
   r.lower_inclusive=String(li);r.upper_inclusive=String(ui);
   r.status=lo!==null&&(v<lo||(v===lo&&!li))?'low':hi!==null&&(v>hi||(v===hi&&!ui))?'high':'within';
   r.reason='入力された基準範囲との数値比較';
  }catch(e){r.reason=e.message;}return r;
 }
 function parseCSV(text){
  if(text.length>200000)throw Error('CSVは200,000文字以内にしてください');
  text=text.replace(/^\uFEFF/,'');let rows=[],row=[],field='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
   if(c==='"'){if(field||closed)throw Error('CSVの引用符が不正です');quoted=true;continue;}
   if(c===','||c==='\n'||c==='\r'){
    row.push(field);field='';closed=false;
    if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}continue;
   }
   if(closed)throw Error('CSVの引用符の後に不正な文字があります');field+=c;
  }
  if(quoted)throw Error('CSVの引用符が閉じていません');
  row.push(field);if(row.some(x=>x!==''))rows.push(row);
  if(rows.length<2)throw Error('CSVにはヘッダーと1行以上のデータが必要です');
  const header=rows.shift().map(x=>x.trim());
  if(header.length!==FIELDS.length||FIELDS.some(k=>!header.includes(k))||new Set(header).size!==FIELDS.length)throw Error('CSVの列名がテンプレートと一致しません');
  if(rows.length>100)throw Error('100項目まで入力できます');
  return rows.map((row,i)=>{if(row.length!==header.length)throw Error('CSVの'+(i+2)+'行目の列数が一致しません');return Object.fromEntries(header.map((k,j)=>[k,row[j]]));});
 }
 function csv(rows){const cell=x=>{let s=String(x??'');if(/^[\s\uFEFF]*[=+@-]/u.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');}
 function range(r){return (r.lower===''?'下限なし':(r.lower_inclusive==='false'?'> ':'≥ ')+r.lower)+' / '+(r.upper===''?'上限なし':(r.upper_inclusive==='false'?'< ':'≤ ')+r.upper)+' '+r.reference_unit;}
 function summary(rows){const count=s=>rows.filter(r=>r.status===s).length;return rows.length+'項目：範囲内 '+count('within')+'件、高値 '+count('high')+'件、低値 '+count('low')+'件、判定不可 '+count('unknown')+'件。入力された基準範囲との比較結果であり、疾患の有無・重症度・緊急性は判定していません。';}
 const TOPICS={reference:'検査施設の基準範囲と、年齢・性別などの適用条件を医療者に確認してください。',unit:'測定値と基準範囲の単位・検査法が一致するか確認してください。',conditions:'採血条件や服薬など、結果の解釈に必要な情報を医療者と確認してください。'};
 function aiPrompt(rows){return '検査結果の比較表を確認用に整理してください。診断・病名・治療・緊急性を推論しないでください。入力は匿名IDと比較区分だけです。次のJSONだけを返してください。groupsには入力のhigh,low,unknownの全IDを過不足なくそのまま分類。withinは含めない。questionsはreference,unit,conditionsから重複なしで選択。余分なキーや文章は不可。形式 {"groups":{"high":[],"low":[],"unknown":[]},"questions":["reference","unit","conditions"]}\n入力データ:\n'+JSON.stringify(rows.map(({id,status})=>({id,status})));}
 function validateAI(raw,rows){
  const s=String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');let data;try{data=JSON.parse(s);}catch{throw Error('AI応答のJSON形式を検証できませんでした。');}
  const keys=(o,n)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===n.sort().join(',');
  if(!keys(data,['groups','questions'])||!keys(data.groups,['high','low','unknown']))throw Error('AI応答の項目形式を検証できませんでした。');
  for(const status of ['high','low','unknown']){const expected=rows.filter(r=>r.status===status).map(r=>r.id).sort(),actual=data.groups[status];if(!Array.isArray(actual)||actual.some(x=>typeof x!=='string')||JSON.stringify([...actual].sort())!==JSON.stringify(expected))throw Error('AI応答が入力の比較結果と一致しません。');}
  if(!Array.isArray(data.questions)||!data.questions.length||data.questions.length>3||new Set(data.questions).size!==data.questions.length||data.questions.some(q=>!Object.hasOwn(TOPICS,q)))throw Error('AIの確認項目を検証できませんでした。');
  return data;
 }
 const api={FIELDS,LABELS,number,compare,parseCSV,csv,range,summary,TOPICS,aiPrompt,validateAI};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BloodReview=api;
})(typeof window!=='undefined'?window:globalThis);
