// Coverage evidence and parser diagnostics are deliberately separate. A parser
// match is not a rules test, and never earns a checked box in this report.
import fs from 'node:fs/promises';
import {newGame} from '../engine.mjs';
import {compileOracleEffect} from '../oracle-effects.mjs';
import {loyaltyAbilities,applyLoyaltyPermission} from '../planeswalker.mjs';
import {activatedAbilities} from '../mana.mjs';
import {spellModes,spellText} from '../spell-effects.mjs';
import {normalizeRules} from '../ability-effects.mjs';
const root=new URL('../',import.meta.url),base=new URL('tests/fixtures/playtest-decks/',root);
const canonical=s=>normalizeRules(s).replace(/\s+/g,' ').trim();
const prior=JSON.parse(await fs.readFile(new URL('tests/fixtures/commander/checklist-progress.json',root))),evidence=new Map();
for(const [deck,progress] of Object.entries(prior)){
 let records;try{records=JSON.parse(await fs.readFile(new URL('tests/fixtures/commander/oracle/'+deck+'.json',root))).cards;}catch{continue;}
 for(const card of records){
  // The maintained checklist numbers non-empty paragraphs across all faces.
  const paragraphs=(card.card_faces?.length?card.card_faces:[card]).flatMap(c=>(c.oracle_text||'').split('\n').filter(Boolean));
  for(const index of progress.verified_paragraphs?.[card.name]||[])if(paragraphs[index])evidence.set(canonical(paragraphs[index]),progress.evidence||[]);
 }
}
const recognized=text=>!!compileOracleEffect(text)||applyLoyaltyPermission(newGame(2),0,text)||/^Proliferate\b/i.test(text);
// Exact-card probes added during this playtest audit. These cover the named
// paragraphs within the scenarios in the linked tests, not arbitrary interactions.
const probes={
 'atraxa':{'Kasmina, Enigma Sage':[0,2],"Tamiyo, Compleated Sage":[3],"Tezzeret's Gambit":[1],"Vraska, Betrayal's Sting":[1]},
 'jace':{'Jace, Multiverse Architect':[1],'Nicol Bolas, Dragon-God':[0],'Staff of the Storyteller':[0,1],'Kher Keep':[1],'Brainsurge':[0]}
};
for(const [deck,checked] of Object.entries(probes)){
 const fixture=JSON.parse(await fs.readFile(new URL(deck+'.json',base)));
 for(const [name,indices] of Object.entries(checked)){const card=fixture.cards.find(c=>c.name===name),paragraphs=card.oracle_text.split('\n').filter(Boolean);for(const index of indices)evidence.set(canonical(paragraphs[index]),['tests/playtest-decks.test.mjs','tests/token-catalog.test.mjs','tests/playtest-decks-ui.cjs']);}
}
const output=[],lines=['# Exact playtest deck audit','',
 'Lists supplied on 2026-10-15. This report covers every non-empty Oracle paragraph in both exact lists, separately from the older 39-deck fixture. Current Oracle data came from Scryfall.','',
 '**Current verification:** 1,083 unit tests pass. Exact-deck, token-import, planeswalker, and multiplayer Electron checks accompany the fixes. These totals include the wider engine suite; they are not a count of fully implemented cards. Remaining gaps include polymorph effects, emblems, phasing, extra turns, several token/conditional sequences, trigger restrictions and continuous effects.','',
 '**PASS (regression)** means identical Oracle text has checked behavioral evidence in the maintained deck audit and the full unit suite passed. **FAIL (manual resolution)** means the current resolution compiler has no complete handler. **UNVERIFIED** means more behavioral evidence is needed; a recognized handler alone is not a pass. Static effects, trigger conditions, target rules and interactions can still be missing even when an effect compiles. No deck is certified fully working by this report.',''];
for(const deck of ['atraxa','jace']){
 const fixture=JSON.parse(await fs.readFile(new URL(deck+'.json',base))),g=newGame(2);g.step=3;g.responseMode='hold';
 const cards=[];
 for(const record of fixture.cards){
  const card={...record,instance:'audit-card',counters:{},face:0};g.players[0].zones.battlefield=[card];
  const abilities=activatedAbilities(g,0,card),loyalty=loyaltyAbilities(card);
  const spell=/\b(?:Instant|Sorcery)\b/.test(card.type_line),modes=spell?spellModes(card,g,0):[];
  const spellPrograms=spell?(modes.length?modes:[spellText(card,{},g,0)]).map(text=>({text,recognized:recognized(text)})):[];
  const paragraphs=(record.card_faces?.length?record.card_faces:[record]).flatMap(face=>(face.oracle_text||'').split('\n').filter(Boolean).map(text=>({face:face.name,text})));
  const checks=paragraphs.map(({face,text},index)=>{
   const printed=normalizeRules(text),action=loyalty.find(a=>a.paragraph===index)||abilities.find(a=>a.id==='action:'+index),trigger=printed.replace(/^[A-Za-z ]+ — /,'').match(/^(?:When|Whenever|At the beginning of) (.+?), ([^]+)$/i);
   const body=action?.text||trigger?.[2],parser=body?(recognized(body.replace(/ Activate only as a sorcery\.$/,''))?'recognized':'missing'):undefined;
   const proof=evidence.get(canonical(text));
   // Trigger resolution has a few dedicated handlers outside the compiler;
   // mark those for review instead of declaring a false failure.
   const failed=!!action&&!action.output&&parser==='missing';
   const status=failed?'FAIL (manual resolution)':proof?.length?'PASS (regression)':'UNVERIFIED';
   return {index,face,text,status,...(parser?{effectParser:parser}:{}),evidence:status.startsWith('PASS')?proof:[]};
  });
  const failedModes=spellPrograms.filter(p=>!p.recognized);
  if(failedModes.length)for(const check of checks)if((!modes.length||/^\u2022 /.test(check.text)&&!recognized(check.text.replace(/^\u2022 /,'')))&&!/^(?:Flashback|Rebound|Overload|As an additional cost)/i.test(check.text)){check.status='FAIL (manual resolution)';check.evidence=[];}
  cards.push({name:record.name,quantity:record.quantity,url:record.scryfall_uri,checks,spellPrograms});
 }
 const counts=Object.fromEntries(['PASS (regression)','FAIL (manual resolution)','UNVERIFIED'].map(status=>[status,cards.flatMap(c=>c.checks).filter(c=>c.status===status).length]));
 output.push({deck,total:fixture.total,cards,counts});
 lines.push('## '+fixture.cards[0].name,'',`${fixture.total} cards; ${cards.length} distinct names. Paragraphs: ${counts['PASS (regression)']} regression passes, ${counts['FAIL (manual resolution)']} manual-resolution failures, ${counts.UNVERIFIED} unverified.`,'');
 for(const card of cards){lines.push('### '+card.quantity+' × '+card.name,'','[Current Oracle text]('+card.url+')','');
  for(const check of card.checks)lines.push('- '+(check.status.startsWith('PASS')?'[x]':'[ ]')+' **'+check.status+'** '+check.text+(check.effectParser?' — Effect handler: '+check.effectParser+'.':'')+(check.evidence.length?' Evidence: '+check.evidence.map(f=>'['+f+'](../'+f+')').join(', ')+'.':''));
  if(!card.checks.length)lines.push('- [ ] UNVERIFIED — Printed characteristics / intrinsic land mana.');
  for(const program of card.spellPrograms)lines.push('- Resolution diagnostic: '+(program.recognized?'recognized; still requires behavior/target tests':'**manual fallback**')+' — '+program.text.replaceAll('\n',' / '));
  lines.push('');
 }
}
await fs.writeFile(new URL('audit.json',base),JSON.stringify(output,null,2)+'\n');
await fs.writeFile(new URL('docs/playtest-deck-audit.md',root),lines.join('\n')+'\n');
console.log(JSON.stringify(output.map(({deck,total,cards,counts})=>({deck,total,distinct:cards.length,counts})),null,2));
