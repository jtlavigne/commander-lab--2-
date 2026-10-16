import {readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'tests/fixtures/keyword-audit-requirements.json'),'utf8'));
const aliases={'Regeneration':'Regenerate','Fabricated':'Fabricate','Totem Armor':'Umbra armor','Tap/untap':'Tap and Untap'};
const tested={
 Support:'Announced optional creature targets on either side; permanent excludes itself; legal-target recheck, counter replacements, Patron triggers.',
 Investigate:'Standalone/repeated actions, functional Clues, separate action triggers, response timing.',
 Populate:'Mandatory own-creature-token choice; copies characteristics without counters/damage/tapping; no-token continuation.',
 Bolster:'Least current toughness and ties; no targeting; mandatory seat-owned choice; counter replacements and reconnect.',
 Adapt:'Checks +1/+1 counters at resolution; repeated activations and source incarnation; counter replacements.',
 Monstrosity:'Once per battlefield incarnation, including zero; counter replacements precede designation and trigger; save/reload.'
};
const sources=await Promise.all((await readdir(root)).filter(f=>f.endsWith('.mjs')&&!/(?:-ui|icons|premade-decks|theme|card-motion)\.mjs$/.test(f)).sort().map(async file=>({file,text:await readFile(path.join(root,file),'utf8')})));
const tests=await Promise.all((await readdir(path.join(root,'tests'))).filter(f=>f.endsWith('.test.mjs')&&f!=='keyword-actions.test.mjs').sort().map(async file=>({file:'tests/'+file,text:await readFile(path.join(root,'tests',file),'utf8')})));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const rows=entries=>entries.map(entry=>{
 const name=aliases[entry.name]||entry.name,pattern=new RegExp('\\b'+escape(name)+'\\b','i');
 return {...entry,canonicalName:name,status:tested[name]?'tested-scope':'not-verified',scope:tested[name]||null,
  sourceCandidates:sources.filter(f=>pattern.test(f.text)).map(f=>f.file),
  testCandidates:tests.filter(f=>pattern.test(f.text)).map(f=>f.file),
  evidence:tested[name]?['tests/keyword-actions.test.mjs',...['Bolster','Investigate'].includes(name)?['tests/network.test.mjs']:[],...['Support','Bolster','Populate','Investigate'].includes(name)?['tests/keyword-actions-ui.cjs']:[]]:[]};
});
const report={rulesDate:manifest.rulesDate,rulesUrl:manifest.rulesUrl,documentUrl:manifest.documentUrl,actions:rows(manifest.actions),documentEntries:rows(manifest.documentEntries)};
const link=(file,prefix='../')=>'['+file+']('+prefix+file+')';
const table=entries=>['| Entry | Rule | Status | Evidence / review leads |','| --- | --- | --- | --- |',...entries.map(e=>{
 const evidence=e.evidence.length?e.evidence.map(f=>link(f)).join(', '):e.sourceCandidates.length?'Source references only: '+e.sourceCandidates.slice(0,3).map(f=>link(f)).join(', '):'No direct keyword reference found; inspect shared equivalents before implementing.';
 return '| '+e.name+' | '+(e.rule||'See classification notes')+' | '+(e.status==='tested-scope'?'[x] Scoped tests; broader interactions open':'[ ] Not verified')+' | '+evidence+' |';
})].join('\n');
const content=`# Keyword implementation audit

This is an incomplete behavior audit, not a declaration that every listed mechanic works. The request covers **${report.actions.length} Rule 701 actions** and **${report.documentEntries.length} entries in the supplied document** (including overlaps). Nothing is marked universally complete. Six actions have newly tested scopes listed below; all other entries still require explicit verification.

Sources: [Comprehensive Rules, effective ${report.rulesDate}](${report.rulesUrl}); [user-supplied keyword guide](${report.documentUrl}). The guide supplies coverage requirements, not executable instructions or authoritative rulings. Names and section membership are preserved in [the input manifest](../tests/fixtures/keyword-audit-requirements.json); the guide's full prose is not copied into the repository.

Regenerate: **node scripts/audit-keywords.mjs**. The [JSON report](keyword-audit.json) includes all source/test search leads. String matches are **not passing tests**; absence of the literal keyword is **not proof of missing behavior**. Existing shared implementations and deck tests must be reviewed before changing them.

## Tested action scopes

${Object.entries(tested).map(([name,scope])=>'- **'+name+':** '+scope).join('\n')}

Evidence records test coverage, not a test run: run **node --test tests/keyword-actions.test.mjs tests/network.test.mjs** and **node launch.cjs tests/keyword-actions-ui.cjs**. Token replacements, unsupported trigger wording, full continuous-effect interactions and arbitrary Oracle wording remain separate audit requirements. The rest of the engine's passing test count does not close this checklist.

## Acceptance gate for every entry

- [ ] Current rules and actual Oracle wording checked; all clauses recognized or explicitly manual.
- [ ] Legal and illegal uses, costs, targets versus choices, zones, timing and responses tested.
- [ ] Replacement/prevention effects, triggers, source changes and simultaneous events tested.
- [ ] UI flow, saved continuation, multiplayer seat authorization and private information tested.
- [ ] Real-card interaction cases pass; documented scope and limitations reviewed.

## Corrections to the supplied guide

Read [keyword-guide-corrections.md](keyword-guide-corrections.md) alongside this checklist. Several statements would introduce rules bugs if implemented literally. Ability words such as Landfall, Coven and Ferocious label the actual printed ability; their labels alone do not specify an effect. Adventure and flip cards have their own card-layout rules (715 and 710). Reconfigure is a keyword ability, not a Rule 701 action. Fabricated is normalized to Fabricate; Totem armor uses the current Umbra armor name.

## Rule 701 actions

${table(report.actions)}

${[...new Set(report.documentEntries.map(e=>e.section))].map(section=>'## Guide: '+section+'\n\n'+table(report.documentEntries.filter(e=>e.section===section))).join('\n\n')}

## Variant-system dependencies

Planeswalk needs Planechase's planar deck, die, planar controller, and encounter sequence. Set in Motion and Abandon need scheme decks and Archenemy rules. Assemble needs Contraptions and sprockets. Attraction actions need an Attraction deck, visits and die results. These are implementation requirements, not ordinary Commander-zone shortcuts or completed mechanics. Dungeon, Ring, day/night, meld, and merged-permanent systems likewise need dedicated persistent state and public/private packet tests.
`;
await writeFile(path.join(root,'docs/keyword-audit.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(root,'docs/keyword-audit.md'),content);
console.log('Recorded '+report.actions.length+' actions and '+report.documentEntries.length+' guide entries. Six action scopes have regression evidence; universal completion is not claimed.');
