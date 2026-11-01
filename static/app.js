'use strict';
const C=BloodReview,$=id=>document.getElementById(id);
let result=null,token='',revision=0,authRevision=0,aiController=null,aiBusy=false,loginBusy=false;
const blank=()=>Object.fromEntries(C.FIELDS.map(k=>[k,k.endsWith('_inclusive')?'true':'']));
function controls(){$('ai').disabled=!result||!token||!$('consent').checked||aiBusy;$('csv').disabled=!result;$('pdf').disabled=!result;$('loginBtn').disabled=loginBusy;$('add').disabled=$('inputs').children.length>=100;}
function clearAI(){revision++;if(aiController)aiController.abort();aiController=null;aiBusy=false;$('aiResult').hidden=true;$('aiNotes').replaceChildren();$('aiStatus').textContent='';controls();}
function changed(){clearAI();result=null;$('report').hidden=true;for(const id of ['metrics','table','findings'])$(id).replaceChildren();$('summary').textContent='';$('status').textContent='入力が変わりました。比較表を作成してください。';controls();}
function addRow(data=blank()){
 if($('inputs').children.length>=100)throw Error('100項目まで入力できます');
 const tr=document.createElement('tr');
 for(const key of ['item','value','unit','lower','lower_inclusive','upper','upper_inclusive','reference_unit']){
  const td=document.createElement('td'),input=document.createElement(key.endsWith('_inclusive')?'select':'input');input.dataset.field=key;input.setAttribute('aria-label',({item:'項目名',value:'測定値',unit:'測定単位',lower:'基準下限',upper:'基準上限',reference_unit:'基準単位',lower_inclusive:'下限の境界条件',upper_inclusive:'上限の境界条件'})[key]);
  if(key.endsWith('_inclusive')){for(const [v,text] of [['true','境界を含む'],['false','境界を含まない']]){const option=document.createElement('option');option.value=v;option.textContent=text;input.append(option);}}
  else{input.type='text';input.maxLength=key==='item'?100:200;if(['value','lower','upper'].includes(key))input.inputMode='decimal';}
  input.value=data[key]??(key.endsWith('_inclusive')?'true':'');input.addEventListener('input',changed);input.addEventListener('change',changed);td.append(input);tr.append(td);
 }
 const td=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.className='quiet';remove.textContent='削除';remove.addEventListener('click',()=>{tr.remove();changed();});td.append(remove);tr.append(td);$('inputs').append(tr);controls();
}
function readRows(){return [...$('inputs').children].map(tr=>Object.fromEntries([...tr.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value])));}
function loadRows(rows){changed();$('inputs').replaceChildren();rows.forEach(addRow);$('status').textContent=rows.length+'項目を読み込みました。内容と基準範囲を確認してください。';controls();}
function cell(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function render(){
 const rows=result.rows;const counts=Object.fromEntries(Object.keys(C.LABELS).map(k=>[k,rows.filter(r=>r.status===k).length]));
 for(const [key,count]of Object.entries(counts)){const metric=cell('div','',$('metrics'));metric.className='metric';cell('strong',String(count),metric);cell('span',C.LABELS[key],metric);}
 const table=cell('table','',$('table')),thead=cell('thead','',table),head=cell('tr','',thead),body=cell('tbody','',table);
 for(const label of ['ID','項目','測定値','単位','基準範囲','区分','確認事項']){const th=cell('th',label,head);th.scope='col';}
 for(const row of rows){const tr=cell('tr','',body);for(const v of [row.id,row.item,row.value,row.unit,C.range(row)])cell('td',v,tr);const td=cell('td','',tr),badge=cell('span',C.LABELS[row.status],td);badge.className='status '+row.status;cell('td',row.reason,tr);}
 $('summary').textContent=C.summary(rows);
 for(const row of rows.filter(r=>r.status!=='within'))cell('li',row.id+' '+row.item+'：'+C.LABELS[row.status]+'。測定値 '+row.value+' '+row.unit+'、基準 '+C.range(row)+'。'+row.reason,$('findings'));
 if(rows.every(r=>r.status==='within'))cell('li','入力された範囲との比較では全項目が範囲内です。健康状態の保証ではありません。',$('findings'));
 $('report').hidden=false;$('status').textContent='比較が完了しました。検査票と照合してください。';controls();
}
function compare(){changed();const rows=readRows().filter(r=>['item','value','unit','lower','upper','reference_unit'].some(k=>r[k].trim()));if(!rows.length){$('status').textContent='1項目以上入力してください。';return;}result={rows:rows.map(C.compare),createdAt:new Date().toLocaleString('ja-JP')};render();}
function download(name,text){const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearAll(){authRevision++;token='';loginBusy=false;changed();$('inputs').replaceChildren();addRow();$('file').value='';$('password').value='';$('username').value='';$('consent').checked=false;$('authStatus').textContent='未ログイン';$('status').textContent='入力・結果を消去しました。';controls();}
async function request(path,payload,auth='',signal){const response=await fetch('/llmjp/'+path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(payload),signal});let data;try{data=await response.json();}catch{throw Error('API応答を読み取れませんでした。');}if(!response.ok){if(response.status===401&&auth&&auth===token){token='';$('authStatus').textContent='再ログインしてください。';controls();}throw Error('APIがエラーを返しました（'+response.status+'）。');}return data;}
$('add').addEventListener('click',()=>{changed();addRow();});$('compare').addEventListener('click',compare);$('clear').addEventListener('click',clearAll);$('logout').addEventListener('click',clearAll);
$('template').addEventListener('click',()=>download('blood-test-template.csv',C.csv([C.FIELDS,['項目名を入力','','','','','','true','true']])));
$('sample').addEventListener('click',()=>loadRows([
 {item:'架空項目A（医療基準ではありません）',value:'12',unit:'demo',lower:'3',upper:'10',reference_unit:'demo',lower_inclusive:'true',upper_inclusive:'true'},
 {item:'架空項目B（医療基準ではありません）',value:'5',unit:'demo',lower:'3',upper:'10',reference_unit:'demo',lower_inclusive:'true',upper_inclusive:'true'},
 {item:'架空項目C（医療基準ではありません）',value:'1',unit:'demo',lower:'3',upper:'10',reference_unit:'demo',lower_inclusive:'true',upper_inclusive:'true'}]));
$('file').addEventListener('change',async()=>{
 changed();const version=revision,file=$('file').files[0];if(!file)return;
 try{if(file.size>200000)throw Error('CSVは200KB以内にしてください');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(version!==revision)return;const rows=C.parseCSV(text);loadRows(rows);$('file').value='';}
 catch(e){if(version===revision)$('status').textContent=e instanceof TypeError?'UTF-8のCSVを使用してください。':e.message;}
 finally{if(version===revision)$('file').value='';}
});
$('csv').addEventListener('click',()=>{if(!result)return;download('blood-test-result.csv',C.csv([['出力日時','ID','項目','測定値','単位','基準範囲','区分','確認事項'],...result.rows.map(r=>[result.createdAt,r.id,r.item,r.value,r.unit,C.range(r),C.LABELS[r.status],r.reason])]));});
$('pdf').addEventListener('click',()=>{if(!result)return;window.print();});
$('consent').addEventListener('change',clearAI);
$('login').addEventListener('submit',async event=>{
 event.preventDefault();if(loginBusy)return;const version=++authRevision;token='';clearAI();loginBusy=true;controls();$('authStatus').textContent='ログイン中…';
 try{const data=await request('auth/login',{username:$('username').value.trim(),password:$('password').value});if(version!==authRevision)return;if(typeof data.access_token!=='string'||!data.access_token)throw Error('認証トークンを取得できませんでした。');token=data.access_token;$('password').value='';$('authStatus').textContent='ログイン済み';}
 catch(e){if(version===authRevision)$('authStatus').textContent=e.message;}
 finally{if(version===authRevision){loginBusy=false;controls();}}
});
$('ai').addEventListener('click',async()=>{
 if(!result||!token||!$('consent').checked||aiBusy)return;
 clearAI();const version=revision,auth=token,snapshot=result;aiController=new AbortController();aiBusy=true;controls();$('aiStatus').textContent='匿名IDと比較区分を送信し、応答を検証中…';
 try{
  const data=await request('generate',{prompt:C.aiPrompt(snapshot.rows),max_tokens:1024},auth,aiController.signal);
  if(version!==revision||auth!==token)return;
  const reviewed=C.validateAI(data.answer,snapshot.rows);
  cell('p',C.summary(snapshot.rows),$('aiNotes'));
  for(const key of reviewed.questions)cell('p',C.TOPICS[key],$('aiNotes'));
  $('aiResult').hidden=false;$('aiStatus').textContent='比較区分の一致を検証しました。AIは定型の確認項目を選択しています。医療者の確認前のメモです。';
 }catch(e){if(version===revision&&e.name!=='AbortError')$('aiStatus').textContent=e.message+' 元の比較結果は変更していません。';}
 finally{if(version===revision){aiBusy=false;aiController=null;controls();}}
});
window.addEventListener('pageshow',clearAll);
addRow();controls();
