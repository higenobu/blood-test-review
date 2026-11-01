const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
async function setup(){
 const dom=new JSDOM(fs.readFileSync('static/index.html','utf8'),{runScripts:'outside-only',url:'https://llm-jp.com/blood-test/'}),w=dom.window,calls=[];let resolveGeneration;w.TextDecoder=TextDecoder;
 w.fetch=async(url,options)=>{calls.push({url,options});if(url.endsWith('auth/login'))return {ok:true,json:async()=>({access_token:'test-token'})};return await new Promise(r=>{resolveGeneration=r;});};
 w.eval(fs.readFileSync('static/core.js','utf8'));w.eval(fs.readFileSync('static/app.js','utf8'));await tick();w.document.getElementById('clear').click();
 return {dom,w,d:w.document,calls,resolve(data){resolveGeneration({ok:true,json:async()=>data});}};
}
test('入力→比較→安全な表→編集で無効化。ブラウザ永続保存なし',async()=>{
 const s=await setup(),{w,d}=s;d.getElementById('sample').click();d.getElementById('compare').click();
 assert.equal(d.querySelectorAll('#table tbody tr').length,3);assert.ok(d.getElementById('summary').textContent.includes('高値 1件'));assert.equal(s.calls.length,0);
 assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 const item=d.querySelector('[data-field=item]');item.value='<img src=x onerror=alert(1)>';item.dispatchEvent(new w.Event('input'));assert.ok(d.getElementById('report').hidden);
 d.getElementById('compare').click();assert.equal(d.querySelector('#table img'),null);assert.ok(d.getElementById('table').textContent.includes('<img'));
 d.getElementById('clear').click();assert.ok(d.getElementById('report').hidden);assert.equal(d.querySelectorAll('#table tbody tr').length,0);s.dom.window.close();
});
test('同意と認証を要求。匿名送信・不正応答拒否・消去後の遅延応答を拒否',async()=>{
 const s=await setup(),{w,d}=s;d.getElementById('sample').click();d.getElementById('compare').click();assert.ok(d.getElementById('ai').disabled);
 d.getElementById('username').value='demo';d.getElementById('password').value='test';d.getElementById('login').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.ok(d.getElementById('ai').disabled);d.getElementById('consent').checked=true;d.getElementById('consent').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('ai').disabled,false);
 d.getElementById('ai').click();const sent=JSON.parse(s.calls[1].options.body);assert.ok(!sent.prompt.includes('架空項目'));assert.ok(!sent.prompt.includes('demo'));assert.equal(s.calls[1].options.headers.Authorization,'Bearer test-token');
 s.resolve({answer:JSON.stringify({groups:{high:['R99'],low:['R3'],unknown:[]},questions:['reference']})});await tick();assert.ok(d.getElementById('aiResult').hidden);assert.ok(d.getElementById('aiStatus').textContent.includes('一致しません'));assert.equal(d.querySelectorAll('#table tbody tr').length,3);
 d.getElementById('ai').click();d.getElementById('clear').click();s.resolve({answer:JSON.stringify({groups:{high:['R1'],low:['R3'],unknown:[]},questions:['reference']})});await tick();assert.ok(d.getElementById('aiResult').hidden);assert.ok(d.getElementById('report').hidden);s.dom.window.close();
});
test('正しいAI分類のみ確認メモを表示。同意撤回で消去',async()=>{
 const s=await setup(),{w,d}=s;d.getElementById('sample').click();d.getElementById('compare').click();
 d.getElementById('username').value='demo';d.getElementById('password').value='test';d.getElementById('login').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 d.getElementById('consent').checked=true;d.getElementById('consent').dispatchEvent(new w.Event('change'));d.getElementById('ai').click();
 s.resolve({answer:JSON.stringify({groups:{high:['R1'],low:['R3'],unknown:[]},questions:['reference','unit']})});await tick();
 assert.equal(d.getElementById('aiResult').hidden,false);assert.ok(d.getElementById('aiNotes').textContent.includes('基準範囲'));assert.equal(d.querySelectorAll('#table tbody tr').length,3);
 d.getElementById('consent').checked=false;d.getElementById('consent').dispatchEvent(new w.Event('change'));assert.ok(d.getElementById('aiResult').hidden);assert.ok(d.getElementById('ai').disabled);s.dom.window.close();
});
test('4列ファイル入力→原文表示→判定不可→手動修正で再比較',async()=>{
 const s=await setup(),{w,d}=s;const text='Test,Value,Normal Range,Unit,\nSynthetic A,6,2-9,demo,\nSynthetic B,6,9月17日,demo,\n';
 const bytes=new TextEncoder().encode(text),file={size:bytes.length,arrayBuffer:async()=>bytes.buffer};
 Object.defineProperty(d.getElementById('file'),'files',{configurable:true,value:[file]});d.getElementById('file').dispatchEvent(new w.Event('change'));await tick();
 assert.equal(d.querySelectorAll('#inputs tr').length,2);assert.ok(d.querySelector('.reference-note').textContent.includes('9月17日'));
 d.getElementById('compare').click();assert.equal(d.querySelectorAll('#table .unknown').length,1);assert.ok(d.getElementById('table').textContent.includes('9月17日'));assert.equal(s.calls.length,0);
 const row=d.querySelectorAll('#inputs tr')[1],lower=row.querySelector('[data-field=lower]'),upper=row.querySelector('[data-field=upper]');lower.value='2';lower.dispatchEvent(new w.Event('input'));upper.value='9';upper.dispatchEvent(new w.Event('input'));
 d.getElementById('compare').click();assert.equal(d.querySelectorAll('#table .within').length,2);assert.equal(d.querySelector('.reference-note'),null);s.dom.window.close();
});
