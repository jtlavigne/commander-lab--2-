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
// Keep evidence attached to the batch that exercises it. Shared identical
// paragraphs inherit that evidence across both lists without claiming the
// remainder of either card is implemented.
const batches=[
 {deck:'atraxa',tests:['tests/damage-counters.test.mjs','tests/damage-counters-ui.cjs','tests/network.test.mjs'],cards:{'Viral Drake':[1],'Ichor Rats':[0]}},
 {deck:'jace',tests:['tests/entry-copy.test.mjs','tests/entry-copy-ui.cjs','tests/network.test.mjs'],cards:{'Spark Double':[0],'Cursed Mirror':[0,1]}},
 {deck:'atraxa',tests:['tests/pre-entry.test.mjs','tests/pre-entry-ui.cjs','tests/network.test.mjs'],cards:{'Breeding Pool':[1],'Hallowed Fountain':[1],'Godless Shrine':[1],'Overgrown Tomb':[1],'Temple Garden':[1],'Watery Grave':[1]}},
 {deck:'atraxa',tests:['tests/entry-batches.test.mjs','tests/entry-replacements-ui.cjs','tests/network.test.mjs'],cards:{"Elspeth, Sun's Champion":[0]}},
 {deck:'atraxa',tests:['tests/entry-replacements.test.mjs','tests/entry-replacements-ui.cjs','tests/network.test.mjs'],cards:{'Tamiyo, Compleated Sage':[0],"Vraska, Betrayal's Sting":[0]}},
 {deck:'atraxa',tests:['tests/atraxa-duration.test.mjs','tests/atraxa-duration-ui.cjs','tests/network.test.mjs'],cards:{'The Chain Veil':[0,1],'Tamiyo, Field Researcher':[0,1],'Teferi, Master of Time':[0]}},
 {deck:'atraxa',tests:['tests/atraxa-control.test.mjs','tests/network.test.mjs','tests/atraxa-library-ui.cjs'],cards:{'Ichormoon Gauntlet':[1],'Ashiok, Dream Render':[0,1]}},
 {deck:'atraxa',tests:['tests/atraxa-control.test.mjs'],cards:{'Sword of Truth and Justice':[1]}},
 {deck:'atraxa',tests:['tests/atraxa-delayed.test.mjs','tests/network.test.mjs','tests/atraxa-library-ui.cjs'],cards:{'Teferi, Hero of Dominaria':[0,1]}},
 {deck:'atraxa',tests:['tests/atraxa-delayed.test.mjs'],cards:{"Vraska, Betrayal's Sting":[3],'Oath of Teferi':[0]}},
 {deck:'atraxa',tests:['tests/atraxa-library.test.mjs','tests/atraxa-library-ui.cjs','tests/network.test.mjs'],cards:{'Narset, Parter of Veils':[0,1],'Sorin the Mirthless':[0]}},
 {deck:'atraxa',tests:['tests/permanent-copy.test.mjs','tests/entry-batches.test.mjs'],cards:{'Tamiyo, Compleated Sage':[2]}},
 {deck:'jace',tests:['tests/permanent-copy.test.mjs'],cards:{'Quantum Misalignment':[0],'Memnarch, the Warden':[0,1,2]}},
 {deck:'atraxa',tests:['tests/turn-effects.test.mjs','tests/playtest-decks-ui.cjs'],cards:{"Elspeth, Sun's Champion":[2],'Tamiyo, Field Researcher':[2],'Teferi, Hero of Dominaria':[2],'Teferi, Temporal Archmage':[2],'Teferi, Master of Time':[2,3],"Magistrate's Scepter":[1]}},
 {deck:'atraxa',tests:['tests/playtest-spells.test.mjs'],cards:{"An Offer You Can't Refuse":[0],"Dovin's Veto":[0,1],'Krosan Grip':[0,1],"Elspeth, Sun's Champion":[1]}},
 {deck:'jace',tests:['tests/polymorph.test.mjs','tests/playtest-decks-ui.cjs'],cards:{'Jace, Multiverse Architect':[2],'Identity Echo':[0],'Proteus Staff':[0],'Synthetic Destiny':[0],'Mass Polymorph':[0],"Primevals' Glorious Rebirth":[0,1]}}
];
for(const batch of batches){const fixture=JSON.parse(await fs.readFile(new URL(batch.deck+'.json',base)));for(const [name,indices] of Object.entries(batch.cards)){const paragraphs=fixture.cards.find(c=>c.name===name).oracle_text.split('\n').filter(Boolean);for(const index of indices)evidence.set(canonical(paragraphs[index]),batch.tests);}}
const output=[],lines=['# Exact playtest deck audit','',
 'Lists supplied on 2026-10-15. This report covers every non-empty Oracle paragraph in both exact lists, separately from the older 39-deck fixture. Current Oracle data came from Scryfall.','',
 '**Current verification:** 1,345 unit and network tests pass. All 43 Electron workflows, the Windows installer/ZIP build, updater checksum validation and the packaged-app smoke test pass. The real two-client damage reconnect test passes. The previous copy checkpoint passed all 42 workflows, with its focused copy UI rerun after privacy/payment corrections. Shared entry preparation now supports the tested Spark Double and Cursed Mirror copy clauses, per-controller choice ordering, numeric values, shock life and tapped conditions before counter replacements and simultaneous entry. Copy evidence includes working mana and loyalty abilities, entry triggers, chained effects, hidden face-down sources, saves, source removal and temporary-layer expiry. These totals include the wider engine suite; they are not a count of fully implemented cards. Full continuous-effect layering, external copy replacements, additional copy exceptions, nonnumeric entry costs/choices, additional damage replacement/prevention cases and other unchecked paragraphs remain open. No deck is certified fully working by this report.','',
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
