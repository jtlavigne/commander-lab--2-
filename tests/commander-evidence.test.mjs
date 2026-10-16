import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('./fixtures/commander/',import.meta.url),read=file=>JSON.parse(readFileSync(new URL(file,base))),progress=read('checklist-progress.json');
// This guards evidence reuse, not gameplay. Behavior is exercised by the linked
// original suites; a changed Oracle record must receive a new behavior audit.
const fields=['name','oracle_text','type_line','mana_cost','cmc','power','toughness','loyalty','defense','colors','color_identity','keywords','card_faces','layout'];
for(const [deck,status] of Object.entries(progress))if(status.reused_cards)test(deck+' shared-card evidence matches completed source records without rules drift',()=>{
 const cards=read('oracle/'+deck+'.json').cards;
 for(const [name,reuse] of Object.entries(status.reused_cards)){
  assert.equal(progress[reuse.deck].checks.final_regression,true,name+' source gate');
  const source=read('oracle/'+reuse.deck+'.json').cards.find(c=>c.name===name),current=cards.find(c=>c.name===name);assert.ok(source&&current,name);
  for(const field of fields)assert.deepEqual(current[field],source[field],name+' '+field);
  for(const paragraph of reuse.paragraphs){assert.ok(progress[reuse.deck].verified_paragraphs[name].includes(paragraph));assert.ok(status.verified_paragraphs[name].includes(paragraph));}
  assert.ok(reuse.evidence.length);for(const file of reuse.evidence)assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);
 }
});
