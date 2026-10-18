import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectiveLandSubtypes} from '../ability-effects.mjs';
import {newGame,advance,endTurn,changeStep,validateSession,transfer} from '../engine.mjs';
import {addMana,manaTotals,manaAbilities,activatedAbilities,activationError,paymentPlan,payMana,clearMana,spellPayment,reverseManaTap,manaOptionKey} from '../mana.mjs';
import {castSpell,activateMana,activateManaLoyalty,prioritySeat,passPriority,canRespond,resolveProliferate,playLand} from '../casting.mjs';
import {landLimit} from '../lands.mjs';
const card=(name,type_line,oracle_text='',extra={})=>({instance:name,name,type_line,oracle_text,counters:{},tapped:false,face:0,...(/\bCreature\b/.test(type_line)?{power:'2',toughness:'2'}:{}),...extra});
const setup=()=>{const g=newGame();g.step=3;g.responseMode='hold';return g;};
const {dryad}=JSON.parse(readFileSync(new URL('./fixtures/mana-fixing.json',import.meta.url),'utf8'));
const source=(g,c,choice={})=>{g.players[0].zones.battlefield.push(c);activateMana(g,c.instance,manaAbilities(g,0,c)[0].id,choice);};

test('floating mana handles basic subtypes, artifacts, creatures, colors and activated costs',()=>{
 const g=setup(),p=g.players[0];source(g,card('Forest','Basic Land — Forest'));source(g,card('Ring','Artifact','{T}: Add {C}{C}.'));
 source(g,card('Elf','Creature — Elf','{T}: Add {G}.'));assert.deepEqual(manaTotals(p),{W:0,U:0,B:0,R:0,G:2,C:2});
 source(g,card('Signet','Artifact','{1}, {T}: Add {W}{U}.'));assert.deepEqual(manaTotals(p),{W:1,U:1,B:0,R:0,G:2,C:1});
 p.zones.command.push(card('Commander','Creature','',{commander:true,color_identity:['B','G']}));const tower=card('Tower','Land','{T}: Add one mana of any color in your commander\'s color identity.');source(g,tower,{color:'B'});assert.equal(manaTotals(p).B,1);
 const ring=p.zones.battlefield.find(c=>c.name==='Ring');assert.throws(()=>activateMana(g,ring.instance,manaAbilities(g,0,ring)[0].id),/tapped/);
});
test('payment respects colored, colorless, generic, snow, hybrid, X and explicit Phyrexian life',()=>{
 const p=newGame().players[0],spell=card('spell','Creature');addMana(p,{G:2,C:2,U:1},{snow:true});
 assert.ok(paymentPlan(p,spell,'{2}{G}{G}'));assert.equal(paymentPlan(p,spell,'{W}'),null);assert.ok(paymentPlan(p,spell,'{C}{S}{G/U}'));
 assert.ok(paymentPlan(p,spell,'{2/W}{U}'));assert.ok(paymentPlan(p,spell,'{X}{G}',{x:4}));assert.equal(paymentPlan(p,spell,'{X}{G}',{x:5}),null);
 assert.equal(paymentPlan(p,spell,'{W/P}'),null);assert.equal(paymentPlan(p,spell,'{W/P}',{allowLife:true}).life,2);
 payMana(p,spell,'{2}{G}');assert.equal(Object.values(manaTotals(p)).reduce((a,b)=>a+b,0),2);
 const nonsnow=newGame().players[0];addMana(nonsnow,{C:2});assert.equal(paymentPlan(nonsnow,spell,'{S}'),null);
});
test('payment finds hybrid alternatives without spending a required colored symbol',()=>{
 const p=newGame().players[0];addMana(p,{W:1,U:1});assert.ok(paymentPlan(p,card('spell','Instant'),'{W/U}{W}'));
});
test('restricted mana stays restricted through replacement multipliers',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield.push(card('Reflection','Enchantment','If you tap a permanent for mana, it produces twice as much of that mana instead.'));
 source(g,card('Restricted','Artifact','{T}: Add {C}{C}. Spend this mana only to cast creature spells.'));
 assert.equal(manaTotals(p).C,4);assert.ok(paymentPlan(p,card('bear','Creature'),'{4}'));assert.equal(paymentPlan(p,card('rock','Artifact'),'{1}'),null);assert.equal(paymentPlan(p,card('ability','Creature'),'{1}',{ability:true}),null);
});
test('multiple doublers multiply source output; triggered extras add independently',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield.push(card('Reflection','Enchantment','If you tap a permanent for mana, it produces twice as much of that mana instead.'),card('Nyxbloom','Enchantment Creature','If you tap a permanent for mana, it produces three times as much of that mana instead.'),card('Wake','Enchantment','Whenever you tap a land for mana, add one mana of any type that land produced.'));
 source(g,card('Forest','Basic Land — Forest'));assert.equal(manaTotals(p).G,7);
 source(g,card('Ring','Artifact','{T}: Add {C}{C}.'));assert.equal(manaTotals(p).C,12);
});
test('global extra mana, nonland extra mana, granted creature abilities and attached auras',()=>{
 const g=setup(),p=g.players[0];g.players[1].zones.battlefield.push(card('Heartbeat','Enchantment','Whenever a player taps a land for mana, that player adds one mana of any type that land produced.'));
 p.zones.battlefield.push(card('Rite','Enchantment','Creatures you control have “{T}: Add one mana of any color.”'),card('Kinnan','Legendary Creature','Whenever you tap a nonland permanent for mana, add one mana of any type that permanent produced.'));
 source(g,card('Forest','Basic Land — Forest'));assert.equal(manaTotals(p).G,2);
 const bear=card('Bear','Creature');source(g,bear,{color:'U'});assert.equal(manaTotals(p).U,2);
 const aura=card('Growth','Enchantment — Aura','Whenever enchanted land is tapped for mana, its controller adds an additional {G}.',{manaSettings:{mode:'auto',attachedTo:'Forest'}});p.zones.battlefield.push(aura);p.zones.battlefield.find(c=>c.name==='Forest').tapped=false;activateMana(g,'Forest','basic:G');assert.equal(manaTotals(p).G,5);
});
test('variable creature production and manual overrides handle conditional amounts',()=>{
 const g=setup(),p=g.players[0];p.zones.battlefield.push(card('Bear','Creature'));source(g,card('Druid','Creature','{T}: Add {G} for each creature you control.'));assert.equal(manaTotals(p).G,2);
 p.zones.battlefield.push(card('Custom','Enchantment','Conditional effect',{manaSettings:{mode:'multiply',scope:'Land',amount:4}}));source(g,card('Forest','Basic Land — Forest'));assert.equal(manaTotals(p).G,6);
});
test('sacrifice only removes the source for a self-sacrifice cost',()=>{
 const g=setup();const altar=card('Altar','Artifact','Sacrifice a creature: Add {C}{C}.');g.players[0].zones.battlefield.push(altar);
 const ability=manaAbilities(g,0,altar)[0];assert.equal(ability.sacrifice,false);assert.throws(()=>activateMana(g,altar.instance,ability.id),/eligible/);
 const bear=card('Sacrifice','Creature','',{power:'2',toughness:'2'});g.players[0].zones.battlefield.push(bear);assert.throws(()=>activateMana(g,altar.instance,ability.id,{costsConfirmed:true}),/Choose an eligible/);activateMana(g,altar.instance,ability.id,{sacrificeId:bear.instance});assert.ok(g.players[0].zones.battlefield.includes(altar));assert.ok(g.players[0].zones.graveyard.includes(bear));assert.equal(manaTotals(g.players[0]).C,2);
 source(g,card('Treasure','Token Artifact','{T}, Sacrifice this artifact: Add one mana of any color.'),{color:'R'});assert.equal(g.players[0].zones.graveyard.at(-1).name,'Treasure');
});
test('every boundary clears all seats; colored and global retention follow the live battlefield',()=>{
 const g=setup(),p=g.players[0];addMana(p,{G:2,R:1});addMana(g.players[1],{U:3});p.zones.battlefield.push(card('Omnath','Creature','You don\'t lose unspent green mana as steps and phases end.'));
 advance(g,{automatic:false});assert.equal(manaTotals(p).G,2);assert.equal(manaTotals(p).R,0);assert.equal(manaTotals(g.players[1]).U,0);
 transfer(g,'Omnath','graveyard',0);changeStep(g,9);assert.equal(manaTotals(p).G,0);
 g.players[2].zones.battlefield.push(card('Upwelling','Enchantment','Players don\'t lose unspent mana as steps and phases end.'));addMana(p,{W:2});endTurn(g);assert.equal(manaTotals(p).W,2);
});
test('colorless conversion preserves mana across turns and temporary retention expires',()=>{
 const g=setup(),p=g.players[0];addMana(p,{R:3},{retain:'turn'});advance(g,{automatic:false});assert.equal(manaTotals(p).R,3);endTurn(g);assert.equal(manaTotals(p).R,0);
 p.zones.battlefield.push(card('Stone','Artifact','If you would lose unspent mana, that mana becomes colorless instead.'));addMana(p,{G:2});clearMana(g);assert.equal(manaTotals(p).C,2);endTurn(g);assert.equal(manaTotals(p).C,2);
});
test('mana, restrictions, response mode and overrides round-trip; invalid sessions fail',()=>{
 const g=setup();addMana(g.players[0],{G:2},{restriction:'creature',snow:true,retain:'turn'});const restored=validateSession(structuredClone(g));assert.deepEqual(restored.players[0].mana,g.players[0].mana);
 const old=setup();delete old.players[0].mana;assert.deepEqual(validateSession(old).players[0].mana,[]);
 for(const amount of [-1,NaN,Infinity,1.5,1000000]){const bad=structuredClone(g);bad.players[0].mana[0].amount=amount;assert.throws(()=>validateSession(bad));}
 const bad=structuredClone(g);bad.responseMode='bad';assert.throws(()=>validateSession(bad));
});
test('casting pays commander tax and X atomically, then resolves after four passes',()=>{
 const g=setup(),p=g.players[0],c=card('Commander','Legendary Creature','',{mana_cost:'{X}{G}',commander:true,commandCasts:2});p.zones.command.push(c);addMana(p,{G:1,C:7});
 assert.equal(spellPayment(g,0,c,'command',{x:4}),null);assert.throws(()=>castSpell(g,c.instance,{x:4}),/pay/);assert.equal(p.zones.command.length,1);
 castSpell(g,c.instance,{x:3});assert.equal(g.stack.length,1);assert.equal(c.commandCasts,3);assert.equal(manaTotals(p).C,0);
 for(let i=0;i<3;i++){passPriority(g,prioritySeat(g));assert.equal(g.stack.length,1);}passPriority(g,prioritySeat(g));assert.equal(g.stack.length,0);assert.equal(p.zones.battlefield[0].name,'Commander');
});
test('instant responses use the stack, reset passes and resolve in last-in-first-out order',()=>{
 const g=setup(),creature=card('Creature','Creature','',{mana_cost:'{G}'}),response=card('Response','Instant','Draw a card.',{mana_cost:'{U}'});g.players[0].zones.hand=[creature];g.players[1].zones.hand=[response];g.players[1].zones.library=[card('Response draw','Land')];addMana(g.players[0],{G:1});addMana(g.players[1],{U:1});castSpell(g,creature.instance);passPriority(g,0);castSpell(g,response.instance);assert.equal(g.priority.passes,0);
 for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(g.players[1].zones.graveyard[0].name,'Response');assert.equal(g.stack[0].card.name,'Creature');
 for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(g.players[0].zones.battlefield.length,1);
});
test('rituals and planeswalker mana resolve on the stack, not on activation',()=>{
 const g=setup(),p=g.players[0];p.zones.hand=[card('Ritual','Instant','Add {B}{B}{B}.',{mana_cost:'{B}'})];addMana(p,{B:1});castSpell(g,'Ritual');assert.equal(manaTotals(p).B,0);for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(manaTotals(p).B,3);
 p.zones.battlefield.push(card('Walker','Planeswalker','+1: Add {R}{R}.',{counters:{loyalty:3}}));activateManaLoyalty(g,'Walker',0);assert.equal(manaTotals(p).R,0);assert.equal(p.zones.battlefield[0].counters.loyalty,4);validateSession(structuredClone(g));for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(manaTotals(p).R,2);
});
test('auto priority skips unavailable seats but considers untapped sources and color requirements',()=>{
 const g=setup();g.responseMode='auto';g.players[0].zones.hand=[card('Bear','Creature','',{mana_cost:'{G}'})];addMana(g.players[0],{G:1});g.players[2].zones.hand=[card('Answer','Instant','',{mana_cost:'{U}'})];g.players[2].zones.battlefield=[card('Island','Basic Land — Island')];
 const before=JSON.stringify(g);assert.equal(canRespond(g,2),true);assert.equal(JSON.stringify(g),before,'Availability checks must not tap sources or spend mana');castSpell(g,'Bear');assert.equal(prioritySeat(g),2);assert.equal(g.stack.length,1);passPriority(g,2);assert.equal(g.stack.length,0);
 const bad=setup();bad.responseMode='auto';bad.players[1].zones.hand=[card('Answer','Instant','',{mana_cost:'{U}'})];bad.players[1].zones.battlefield=[card('Forest','Basic Land — Forest')];assert.equal(canRespond(bad,1),false);
});
test('privacy mode never auto-passes based on private response availability',()=>{
 const g=setup();g.players[0].zones.hand=[card('Bear','Creature','',{mana_cost:'{0}'})];castSpell(g,'Bear');assert.equal(prioritySeat(g),0);for(let i=0;i<3;i++)passPriority(g,prioritySeat(g));assert.equal(g.stack.length,1);passPriority(g,prioritySeat(g));assert.equal(g.stack.length,0);
});
test('triomes offer their three intrinsic colors, and filter-land outputs require the right input',()=>{
 const g=setup(),p=g.players[0],triome=card('Triome','Land — Forest Island Mountain','({T}: Add {G}, {U}, or {R}.)\nTriome enters tapped.');p.zones.battlefield.push(triome);assert.equal(manaAbilities(g,0,triome).length,3);
 const filter=card('Fire-Lit Thicket','Land','{T}: Add {C}.\n{R/G}, {T}: Add {R}{R}, {R}{G}, or {G}{G}.');p.zones.battlefield.push(filter);let abilities=activatedAbilities(g,0,filter);assert.equal(abilities.length,2);assert.equal(abilities[1].output.alternatives.length,3);assert.ok(activationError(g,0,filter,abilities[1]));
 addMana(p,{U:1});assert.ok(activationError(g,0,filter,abilities[1]),'Blue cannot pay a red/green filter cost');addMana(p,{G:1});assert.equal(activationError(g,0,filter,abilities[1]),'');activateMana(g,filter.instance,abilities[1].id,{outputIndex:1});assert.equal(manaTotals(p).G,1);assert.equal(manaTotals(p).R,1);assert.equal(manaTotals(p).U,1);
});
test('Dryad grants each controlled land five single-mana choices without replacing existing abilities',()=>{
 const g=setup(),p=g.players[0],forest=card('Forest','Basic Land — Forest'),utility=card('Utility','Land — Desert','{T}: Add {C}.\n{4}, {T}: Proliferate.'),fixer={...dryad,instance:'dryad',counters:{}},bear=card('Bear','Creature');
 p.zones.battlefield=[forest,utility,bear];g.players[1].zones.battlefield=[card('Opponent Forest','Basic Land — Forest')];
 const colors=c=>manaAbilities(g,0,c).filter(a=>a.id.startsWith('basic:')).map(a=>a.id.slice(6));
 assert.deepEqual(colors(forest),['G']);assert.deepEqual(colors(utility),[]);
 p.zones.battlefield.push(fixer);assert.deepEqual(colors(forest),['W','U','B','R','G']);assert.deepEqual(colors(utility),['W','U','B','R','G']);assert.deepEqual(manaAbilities(g,0,bear),[]);assert.equal(manaAbilities(g,1,g.players[1].zones.battlefield[0]).length,1);
 assert.deepEqual(new Set(effectiveLandSubtypes(g,0,utility)),new Set(['Desert','Plains','Island','Swamp','Mountain','Forest']));assert.equal(utility.type_line,'Land — Desert');assert.equal(activatedAbilities(g,0,utility).filter(a=>!a.output).length,1);
 activateMana(g,utility.instance,'basic:U');assert.deepEqual(manaTotals(p),{W:0,U:1,B:0,R:0,G:0,C:0});assert.throws(()=>activateMana(g,utility.instance,'basic:R'),/tapped/);reverseManaTap(g,utility);assert.equal(manaTotals(p).U,0);
 activateMana(g,utility.instance,'own:0');assert.equal(manaTotals(p).C,1);reverseManaTap(g,utility);
 const entered=card('New Land','Land');p.zones.battlefield.push(entered);assert.equal(colors(entered).length,5);
 fixer.faceDown=true;assert.deepEqual(colors(forest),['G']);fixer.faceDown=false;assert.equal(colors(forest).length,5);
 transfer(g,fixer.instance,'battlefield',1);assert.deepEqual(colors(forest),['G']);assert.equal(manaAbilities(g,1,g.players[1].zones.battlefield[0]).length,5);
 transfer(g,fixer.instance,'graveyard',1);assert.equal(manaAbilities(g,1,g.players[1].zones.battlefield[0]).length,1);assert.deepEqual(colors(utility),[]);
});
test('additive land types are text-driven, scoped, and shared by mana modifiers and possible-color queries',()=>{
 const g=setup(),p=g.players[0],land=card('Utility','Land — Desert','{T}: Add {C}.'),global=card('Type source','Land','Each land is a Forest in addition to its other land types.'),orchard=card('Orchard','Land','{T}: Add one mana of any color that a land an opponent controls could produce.');
 p.zones.battlefield=[land,global,card('Bonus','Enchantment','',{manaSettings:{mode:'extra',scope:'Forest',color:'G',amount:1}})];g.players[1].zones.battlefield=[orchard];
 assert.ok(manaAbilities(g,0,land).some(a=>a.id==='basic:G'));assert.ok(manaAbilities(g,1,orchard).some(a=>a.id==='basic:G'));assert.deepEqual(manaAbilities(g,1,orchard)[0].output.colors,['G']);
 activateMana(g,land.instance,'basic:G');assert.equal(manaTotals(p).G,2);reverseManaTap(g,land);assert.equal(manaTotals(p).G,0);
 global.oracle_text='Lands your opponents control are every basic land type in addition to their other types.';assert.equal(manaAbilities(g,0,land).length,1);assert.equal(manaAbilities(g,1,orchard).filter(a=>a.id.startsWith('basic:')).length,5);
 global.oracle_text='Enchanted land is a Swamp in addition to its other types.';global.manaSettings={mode:'auto',attachedTo:land.instance};assert.ok(manaAbilities(g,0,land).some(a=>a.id==='basic:B'));assert.equal(manaAbilities(g,1,orchard).filter(a=>a.id.startsWith('basic:')).length,0);
 global.manaSettings.mode='ignore';assert.equal(manaAbilities(g,0,land).length,1);
});
test('Dryad fixing feeds opponent land color discovery and automatic response checks without changing pools',()=>{
 const g=setup(),p=g.players[1],forest=card('Opponent Forest','Basic Land — Forest');p.zones.battlefield=[forest,{...dryad,instance:'dryad',counters:{}}];p.zones.hand=[card('Blue response','Instant','',{mana_cost:'{U}'})];
 const orchard=card('Orchard','Land','{T}: Add one mana of any color that a land an opponent controls could produce.');g.players[0].zones.battlefield=[orchard];const before=JSON.stringify(g);assert.equal(canRespond(g,1),true);assert.equal(JSON.stringify(g),before);assert.deepEqual(manaAbilities(g,0,orchard)[0].output.colors,['W','U','B','R','G']);
 forest.tapped=true;assert.deepEqual(manaAbilities(g,0,orchard)[0].output.colors,['W','U','B','R','G']);activateMana(g,orchard.instance,'own:0',{color:'B'});assert.equal(manaTotals(g.players[0]).B,1);
 transfer(g,'dryad','graveyard',1);assert.deepEqual(manaAbilities(g,0,orchard)[0].output.colors,['G']);assert.equal(manaTotals(g.players[0]).B,1,'Removing fixing does not change already floating mana');forest.tapped=false;assert.equal(canRespond(g,1),false);
});
test('equivalent mana choices merge across printed and granted abilities while costs and drawbacks remain distinct',()=>{
 const g=setup(),p=g.players[0],land=card('Forest','Basic Land — Forest','{1}, {T}: Add {U}.\n{T}: Add {G}. This land deals 1 damage to you.');p.zones.battlefield=[land,{...dryad,instance:'dryad',counters:{}},card('Lantern','Artifact','Lands you control have "{T}: Add one mana of any color."')];
 const abilities=manaAbilities(g,0,land),key=(ability,choice={})=>manaOptionKey(g,0,land,ability,choice),intrinsic=abilities.find(a=>a.id==='basic:U'),granted=abilities.find(a=>a.grantedBy==='Lantern');assert.equal(key(intrinsic),key(granted,{color:'U'}));assert.notEqual(key(intrinsic),key(granted,{color:'R'}));assert.notEqual(key(abilities.find(a=>a.id==='own:0')),key(intrinsic));assert.equal(key(abilities.find(a=>a.id==='own:1')),null);
});
test('Karn’s Bastion can pay for proliferate instead of producing colorless, with responses before counter choices',()=>{
 const g=setup(),p=g.players[0],bastion=card('Bastion','Land','{T}: Add {C}.\n{4}, {T}: Proliferate.');p.zones.battlefield.push(bastion,card('Walker','Planeswalker','',{counters:{loyalty:3,shield:1}}));p.poison=2;addMana(p,{C:4});
 const ability=activatedAbilities(g,0,bastion).find(a=>!a.output);assert.equal(activationError(g,0,bastion,ability),'');activateMana(g,bastion.instance,ability.id);assert.equal(bastion.tapped,true);assert.equal(manaTotals(p).C,0);assert.equal(g.stack[0].kind,'ability');validateSession(structuredClone(g));
 for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(g.pendingEffect.kind,'proliferate');assert.throws(()=>advance(g),/pending/);resolveProliferate(g,['Walker'],[0]);assert.deepEqual(p.zones.battlefield[1].counters,{loyalty:4,shield:2});assert.equal(p.poison,3);assert.equal(g.pendingEffect,undefined);
});
test('ordinary untaps return only their own unspent activation; effect untaps preserve mana',()=>{
 const g=setup(),p=g.players[0],first=card('Forest','Basic Land — Forest'),second=card('Forest','Basic Land — Forest',{},{instance:'second'});first.oracle_text='({T}: Add {G}.)';second.oracle_text='';
 assert.equal(manaAbilities(g,0,first)[0].manualCost,false,'Parenthesized reminder text must not become an extra cost');source(g,first);source(g,second);assert.equal(p.mana.length,2,'Identical cards must retain independent activation provenance');
 payMana(p,card('Spell','Creature'),'{G}');assert.throws(()=>reverseManaTap(g,first),/spent or cleared/);assert.equal(first.tapped,true);
 reverseManaTap(g,second);assert.equal(second.tapped,false);assert.equal(manaTotals(p).G,0);
 source(g,card('Island','Basic Land — Island'));const island=p.zones.battlefield.at(-1);reverseManaTap(g,island,{fromEffect:true});assert.equal(manaTotals(p).U,1);assert.equal(island.tapped,false);
});
test('reversing a filter activation removes its full output and restores the exact input mana',()=>{
 const g=setup(),p=g.players[0],forest=card('Forest','Basic Land — Forest');source(g,forest);const filter=card('Filter','Land','{R/G}, {T}: Add {R}{R}, {R}{G}, or {G}{G}.');source(g,filter,{outputIndex:0});assert.equal(manaTotals(p).R,2);assert.throws(()=>reverseManaTap(g,forest),/spent/);
 const saved=validateSession(structuredClone(g)),restored=saved.players[0].zones.battlefield.find(c=>c.instance==='Filter');reverseManaTap(saved,restored);assert.equal(manaTotals(saved.players[0]).R,0);assert.equal(manaTotals(saved.players[0]).G,1);reverseManaTap(saved,saved.players[0].zones.battlefield[0]);assert.equal(manaTotals(saved.players[0]).G,0);
});
test('spent or phase-cleared mana blocks corrective untaps; a new turn untaps normally',()=>{
 const g=setup(),c=card('Forest','Basic Land — Forest');source(g,c);advance(g,{automatic:false});assert.throws(()=>reverseManaTap(g,c),/cleared/);g.active=3;g.step=11;advance(g,{automatic:true});assert.equal(g.active,0);assert.equal(c.tapped,false);assert.equal(c.manaActivation,undefined);
});
test('explicit payment colors must exactly cover the cost and cannot overpay or bypass restrictions',()=>{
 const p=newGame().players[0],spell=card('Spell','Creature');addMana(p,{G:3,C:2,U:1});const before=structuredClone(p.mana);
 const plan=paymentPlan(p,spell,'{1}{G}',{spend:{G:2}});assert.ok(plan);assert.deepEqual(p.mana,before);
 assert.equal(paymentPlan(p,spell,'{1}{G}',{spend:{U:1,C:1}}),null);assert.equal(paymentPlan(p,spell,'{1}{G}',{spend:{G:3}}),null);
 payMana(p,spell,'{1}{G}',{spend:{G:2}});assert.equal(manaTotals(p).G,1);assert.equal(manaTotals(p).C,2);assert.equal(manaTotals(p).U,1);
});
test('each printed X adds its chosen value; a six-mana XX payment at X=3 leaves zero',()=>{
 const p=newGame().players[0],spell=card('Ballista','Artifact Creature');addMana(p,{G:5,B:1});assert.ok(paymentPlan(p,spell,'{X}{X}',{x:3,spend:{G:5,B:1}}));assert.equal(paymentPlan(p,spell,'{X}{X}',{x:4}),null);assert.equal(manaTotals(p).G,5);payMana(p,spell,'{X}{X}',{x:3,spend:{G:5,B:1}});assert.equal(Object.values(manaTotals(p)).reduce((a,b)=>a+b,0),0);
});
test('land plays enforce the turn allowance, include permissions and reset on the next turn',()=>{
 const g=setup(),p=g.players[0];p.zones.library=[card('Explore draw','Land')];p.zones.hand=[card('L1','Land'),card('L2','Land'),card('L3','Land'),card('L4','Land')];playLand(g,'L1');assert.equal(p.landsPlayed,1);assert.throws(()=>playLand(g,'L2'),/all your land plays/);
 p.zones.battlefield.push(card('Azusa','Creature','You may play two additional lands on each of your turns.'));assert.equal(landLimit(g,0),3);playLand(g,'L2');playLand(g,'L3');assert.throws(()=>playLand(g,'L4'),/all your land plays/);
 p.extraLandPlays=1;playLand(g,'L4');assert.equal(p.landsPlayed,4);for(let i=0;i<4;i++)endTurn(g);assert.equal(p.landsPlayed,0);assert.equal(p.extraLandPlays,0);assert.equal(landLimit(g,0),3);
});
test('resolving an extra-land spell grants a temporary play without putting land plays on the stack',()=>{
 const g=setup(),p=g.players[0];p.zones.library=[card('Explore draw','Land')];p.zones.hand=[card('L1','Land'),card('L2','Land'),card('Explore','Sorcery','You may play an additional land this turn.\nDraw a card.',{mana_cost:'{0}'})];playLand(g,'L1');castSpell(g,'Explore');for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));assert.equal(landLimit(g,0),2);playLand(g,'L2');assert.equal(p.landsPlayed,2);assert.equal(g.stack.length,0);
});
test('Exotic Orchard only offers colors opponents’ lands could produce, even if tapped',()=>{
 const g=setup(),orchard=card('Orchard','Land','{T}: Add one mana of any color that a land an opponent controls could produce.');g.players[0].zones.battlefield=[orchard,card('Own Forest','Land — Forest')];
 let ability=manaAbilities(g,0,orchard)[0];assert.deepEqual(ability.output.colors,[]);assert.ok(activationError(g,0,orchard,ability));assert.throws(()=>activateMana(g,'Orchard',ability.id,{color:'G'}),/eligible mana type/);
 g.players[1].zones.battlefield=[card('Opponent Island','Basic Land — Island','',{tapped:true}),card('Opponent Wastes','Basic Land','{T}: Add {C}.')];ability=manaAbilities(g,0,orchard)[0];assert.deepEqual(ability.output.colors,['U']);assert.throws(()=>activateMana(g,'Orchard',ability.id,{color:'R'}),/allowed mana color/);activateMana(g,'Orchard',ability.id,{color:'U'});assert.equal(manaTotals(g.players[0]).U,1);
});
test('circular Orchards and Reflecting Pools cannot bootstrap colors; filter-land costs do not restrict possible types',()=>{
 const g=setup(),orchard=(id)=>card(id,'Land','{T}: Add one mana of any color that a land an opponent controls could produce.'),pool=card('Pool','Land','{T}: Add one mana of any type that a land you control could produce.');g.players[0].zones.battlefield=[orchard('O1'),pool];g.players[1].zones.battlefield=[orchard('O2')];
 assert.deepEqual(manaAbilities(g,0,g.players[0].zones.battlefield[0])[0].output.colors,[]);assert.deepEqual(manaAbilities(g,0,pool)[0].output.colors,[]);
 g.players[1].zones.battlefield.push(card('Filter','Land','{T}: Add {C}.\n{R/G}, {T}: Add {R}{R}, {R}{G}, or {G}{G}.',{tapped:true}));assert.deepEqual(manaAbilities(g,0,g.players[0].zones.battlefield[0])[0].output.colors,['R','G']);
 g.players[0].zones.battlefield.push(card('Wastes','Basic Land','{T}: Add {C}.'));assert.deepEqual(manaAbilities(g,0,pool)[0].output.colors,['R','G','C']);
});
test('an opposing land whose currently determined output is zero supplies no Orchard color',()=>{
 const g=setup(),orchard=card('Orchard','Land','{T}: Add one mana of any color that a land an opponent controls could produce.');g.players[0].zones.battlefield=[orchard];g.players[1].zones.battlefield=[card('Cradle','Land','{T}: Add {G} for each creature you control.')];assert.deepEqual(manaAbilities(g,0,orchard)[0].output.colors,[]);g.players[1].zones.battlefield.push(card('Bear','Creature'));assert.deepEqual(manaAbilities(g,0,orchard)[0].output.colors,['G']);
});
