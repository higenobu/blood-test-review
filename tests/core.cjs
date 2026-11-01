const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../static/core.js');
const row=overrides=>({item:'架空項目',value:'5',unit:'demo',lower:'3',upper:'10',reference_unit:'demo',...overrides});
test('範囲内・上下限・境界を含む/含まない',()=>{
 for(const [value,status]of [['2','low'],['3','within'],['5','within'],['10','within'],['11','high']])assert.equal(C.compare(row({value})).status,status);
 assert.equal(C.compare(row({value:'3',lower_inclusive:'false'})).status,'low');
 assert.equal(C.compare(row({value:'10',upper_inclusive:'false'})).status,'high');
 assert.equal(C.compare(row({value:'0',lower:'0'})).status,'within');
});
test('片側範囲・単位・欠損・非数値・矛盾を混同しない',()=>{
 assert.equal(C.compare(row({lower:''})).status,'within');assert.equal(C.compare(row({upper:''})).status,'within');
 for(const data of [{lower:'',upper:''},{unit:'other'},{unit:''},{reference_unit:''},{value:''},{value:'<5'},{value:'陽性'},{value:'1,000'},{value:'Infinity'},{lower:'11'},{lower:'5',upper:'5',lower_inclusive:'false'},{lower_inclusive:'maybe'},{item:''}])assert.equal(C.compare(row(data)).status,'unknown',JSON.stringify(data));
 assert.equal(C.compare(row({value:'5',lower:'5',upper:'5'})).status,'within');
 assert.equal(C.compare(row({value:'1e-324'})).status,'unknown');assert.equal(C.compare(row({value:'10000000000000001'})).status,'unknown');
});
test('CSVの引用符・改行・BOM・列順・失敗時拒否',()=>{
 const raw='\uFEFF'+C.FIELDS.join(',')+'\r\n"項目,\"\"引用\"\"\n続き",5,demo,3,10,demo,true,false\r\n';
 const parsed=C.parseCSV(raw);assert.equal(parsed[0].item,'項目,"引用"\n続き');assert.equal(C.compare(parsed[0]).status,'within');
 const reversed=[...C.FIELDS].reverse();assert.equal(C.parseCSV(reversed.join(',')+'\n'+reversed.map(k=>row({lower_inclusive:'true',upper_inclusive:'true'})[k]).join(','))[0].item,'架空項目');
 for(const text of ['item,value\na,5',C.FIELDS.join(',')+'\n"unclosed',C.FIELDS.join(',')+'\na,b',C.FIELDS.join(',')+'\n"a"x,5,demo,3,10,demo,true,true','x'.repeat(200001)])assert.throws(()=>C.parseCSV(text));
 assert.throws(()=>C.parseCSV(C.FIELDS.join(',')+'\n'+Array(101).fill('a,5,demo,3,10,demo,true,true').join('\n')));
});
test('CSV出力の引用・数式対策',()=>{const s=C.csv([['=1+1','  @sum(a)','日本語,"引用"\n次行']]);assert.ok(s.startsWith('\uFEFF'));assert.ok(s.includes("\"'=1+1\""));assert.ok(s.includes('"日本語,""引用""\n次行"'));});
test('AIの捏造・分類変更・重複・不足・自由記述を拒否',()=>{
 const rows=[C.compare(row({value:'12'}),0),C.compare(row({value:'2'}),1),C.compare(row({unit:''}),2),C.compare(row({}),3)];
 const valid={groups:{high:['R1'],low:['R2'],unknown:['R3']},questions:['reference']};
 assert.deepEqual(C.validateAI(JSON.stringify(valid),rows),valid);
 for(const mutate of [d=>d.groups.high.push('R9'),d=>d.groups.high.push('R1'),d=>d.groups.high=[],d=>d.groups.low=['R1'],d=>d.questions=['診断'],d=>d.questions=['reference','reference'],d=>d.summary='健康です']){const d=structuredClone(valid);mutate(d);assert.throws(()=>C.validateAI(JSON.stringify(d),rows));}
 const payload=C.aiPrompt(rows);assert.ok(!payload.includes('架空項目'));assert.ok(!payload.includes('demo'));assert.ok(!payload.includes('12'));assert.ok(payload.includes('R1'));
});
