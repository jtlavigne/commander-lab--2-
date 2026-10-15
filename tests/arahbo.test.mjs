import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,transfer,findCard,changeStep,advance,validateSession,endTurn} from '../engine.mjs';
import {castSpell,resolveTop,activateMana,castingTiming,passPriority} from '../casting.mjs';
import {setAttacker,confirmAttackers,stateBasedActions,combatStats,dealDamagePackets} from '../combat.mjs';
import {keywordSet,protectedFrom} from '../creature-rules.mjs';
import {activatedAbilities,activationError,addMana,manaTotals} from '../mana.mjs';
import {spellTargetOptions} from '../spell-effects.mjs';
import {chooseTriggerTarget,triggerTargetOptions,queueCombatTriggers} from '../combat-effects.mjs';
import {resolveOracleChoice,oracleChoiceOptions} from '../oracle-effects.mjs';
import {attachPermanent} from '../attachments.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {reduceAction} from '../multiplayer/actions.mjs';
import {projectGame} from '../multiplayer/protocol.mjs';
const cards=JSON.parse(readFileSync(new URL('./fixtures/commander/oracle/arahbo_roar_of_the_world.json',import.meta.url))).cards;
const card=name=>{const c=cards.find(c=>c.name===name);assert.ok(c,name);return {...structuredClone(c),instance:crypto.randomUUID(),counters:{},face:0};};
const game=(count=2)=>{const g=newGame(count);g.step=3;g.responseMode='hold';return g;};
const hand=(g,name,owner=0)=>{const c=card(name);g.players[owner].zones.hand.push(c);return c;};
function enter(g,name,owner=0){const c=hand(g,name,owner);transfer(g,c.instance,'battlefield',owner);c.summoningSick=false;return c;}
function kitty(g,owner=0,{name='Cat',power='2',toughness='3',type_line='Creature — Cat',oracle_text=''}={}){const c={instance:crypto.randomUUID(),name,type_line,power,toughness,oracle_text,counters:{}};g.players[owner].zones.hand.push(c);transfer(g,c.instance,'battlefield',owner);c.summoningSick=false;return c;}
function castAura(g,name,target,owner=0){const c=hand(g,name,owner);addMana(g.players[owner],{W:20,G:20,C:20});castSpell(g,c.instance,{targets:['card:'+target.instance]});return c;}
function equip(g,name,target){const c=enter(g,name);assert.equal(attachPermanent(g,c.instance,target.instance),true);return c;}

for(const name of ['Open the Armory',"Steelshaper's Gift"])test('Arahbo: '+name+' searches only its named card types, preserves the resolving spell and shuffles after choosing',()=>{
 const g=game(),spell=hand(g,name),equipment=card('Swiftfoot Boots'),aura=card('Rancor'),creature=card('Regal Caracal');g.players[0].zones.library=[equipment,aura,creature];addMana(g.players[0],{W:2,C:2});castSpell(g,spell.instance);resolveTop(g);assert.equal(g.pendingEffect.step.op,'search');const choices=oracleChoiceOptions(g).map(c=>c.key);assert.ok(choices.includes(equipment.instance));assert.equal(choices.includes(aura.instance),name==='Open the Armory');assert.ok(!choices.includes(creature.instance));assert.equal(findCard(g,spell.instance).zone,'stack');validateSession(JSON.parse(JSON.stringify(g)));resolveOracleChoice(g,[equipment.instance]);assert.ok(g.players[0].zones.hand.includes(equipment));assert.ok(g.players[0].zones.graveyard.includes(spell));assert.equal(g.pendingEffect,undefined);
});
test('Arahbo: Stoneforge search is optional and its activated hand deployment only accepts Equipment, with no cast trigger',()=>{
 const g=game(),mystic=enter(g,'Stoneforge Mystic'),equipment=card('Swiftfoot Boots');g.players[0].zones.library=[equipment,card('Forest')];resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.deepEqual(oracleChoiceOptions(g).map(c=>c.key),[equipment.instance]);resolveOracleChoice(g,[equipment.instance]);const cat=hand(g,'Regal Caracal');addMana(g.players[0],{W:1,C:1});activateMana(g,mystic.instance,'action:1');assert.equal(mystic.tapped,true);resolveTop(g);assert.deepEqual(oracleChoiceOptions(g).map(c=>c.key),[equipment.instance]);assert.throws(()=>resolveOracleChoice(g,[cat.instance]));resolveOracleChoice(g,[equipment.instance]);assert.ok(g.players[0].zones.battlefield.includes(equipment));assert.ok(g.players[0].zones.hand.includes(cat));assert.equal(g.pendingEffect,undefined);
});

test('Arahbo: Aura targets are announced before payment, remain on stack through responses and attach only on resolution',()=>{
 const g=game(),cat=kitty(g),rancor=castAura(g,'Rancor',cat);assert.equal(rancor.attachedTo,undefined);assert.equal(g.stack[0].targets[0].id,cat.instance);assert.equal(combatStats(g,0,cat).power,2);passPriority(g,0);passPriority(g,1);assert.equal(rancor.attachedTo,cat.instance);assert.equal(rancor.attachedBattlefieldId,cat.battlefieldId);assert.equal(combatStats(g,0,cat).power,4);assert.ok(keywordSet(g,0,cat).has('trample'));validateSession(g);
});
test('Arahbo: an Aura with an illegal target goes directly to graveyard without an enters or Rancor return trigger',()=>{
 const g=game(),cat=kitty(g),rancor=castAura(g,'Rancor',cat);transfer(g,cat.instance,'exile',0);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(rancor));assert.equal(g.stack.length,0);assert.equal(g.pendingEffect,undefined);
});
test('Arahbo: targets recheck shroud and protection, permit friendly hexproof and ignore hidden opposing hands',()=>{
 const g=game(4),cat=kitty(g),enemy=kitty(g,1,{oracle_text:'Hexproof'}),rancor=hand(g,'Rancor');assert.ok(spellTargetOptions(g,0,rancor).some(t=>t.id===cat.instance));assert.equal(spellTargetOptions(g,0,rancor).some(t=>t.id===enemy.instance),false);cat.temporaryKeywords=['hexproof'];assert.ok(spellTargetOptions(g,0,rancor).some(t=>t.id===cat.instance));cat.temporaryKeywords=['shroud'];assert.equal(spellTargetOptions(g,0,rancor).some(t=>t.id===cat.instance),false);cat.temporaryKeywords=[];cat.oracle_text='Protection from green';assert.equal(spellTargetOptions(g,0,rancor).some(t=>t.id===cat.instance),false);
});
test('Arahbo: an Aura target that leaves and returns is a new object',()=>{
 const g=game(),cat=kitty(g),aura=castAura(g,'Rancor',cat);transfer(g,cat.instance,'exile',0);transfer(g,cat.instance,'battlefield',0);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(aura));assert.equal(aura.attachedTo,undefined);
});
test('Arahbo: losing an enchanted creature sends Rancor to graveyard and its separate return trigger can be answered',()=>{
 const g=game(),cat=kitty(g),aura=castAura(g,'Rancor',cat);resolveTop(g);transfer(g,cat.instance,'exile',0);stateBasedActions(g);assert.ok(g.players[0].zones.graveyard.includes(aura));assert.equal(g.stack.length,1);resolveTop(g);assert.ok(g.players[0].zones.hand.includes(aura));assert.equal(aura.attachedTo,undefined);
});
test('Arahbo: Rancor cannot return a different graveyard incarnation',()=>{
 const g=game(),cat=kitty(g),aura=castAura(g,'Rancor',cat);resolveTop(g);transfer(g,aura.instance,'graveyard',0);transfer(g,aura.instance,'exile',0);transfer(g,aura.instance,'graveyard',0);resolveTop(g);assert.ok(g.players[0].zones.graveyard.includes(aura));
});
test('Arahbo: Equipment detaches and stays on the field when its creature leaves, without reattaching on return',()=>{
 const g=game(),cat=kitty(g),spear=equip(g,'Shadowspear',cat);assert.equal(combatStats(g,0,cat).power,3);assert.ok(keywordSet(g,0,cat).has('lifelink'));transfer(g,cat.instance,'exile',0);stateBasedActions(g);assert.ok(g.players[0].zones.battlefield.includes(spear));assert.equal(spear.attachedTo,undefined);transfer(g,cat.instance,'battlefield',0);assert.equal(combatStats(g,0,cat).power,2);
});
test('Arahbo: illegal attachments fall off when protection changes; existing shroud does not detach Equipment',()=>{
 const g=game(),cat=kitty(g),boots=equip(g,'Lightning Greaves',cat),aura=castAura(g,'Rancor',kitty(g));resolveTop(g);stateBasedActions(g);assert.equal(boots.attachedTo,cat.instance);const recipient=g.players[0].zones.battlefield.find(c=>c.instance===aura.attachedTo);recipient.temporaryKeywords=['protection from green'];stateBasedActions(g);assert.ok(g.players[0].zones.graveyard.includes(aura));
});
test('Arahbo: Ancestral Mask counts other enchantments across the table and updates as they leave',()=>{
 const g=game(4),cat=kitty(g),mask=castAura(g,'Ancestral Mask',cat);resolveTop(g);assert.equal(combatStats(g,0,cat).power,2);const one=enter(g,"Sigarda's Aid",1),two=enter(g,'Heroic Intervention',2);two.type_line='Artifact Enchantment';assert.equal(combatStats(g,0,cat).power,6);transfer(g,one.instance,'exile',1);assert.equal(combatStats(g,0,cat).power,4);
});
test('Arahbo: All That Glitters counts an artifact enchantment once and follows its Aura controller',()=>{
 const g=game(),cat=kitty(g,1),aura=castAura(g,'All That Glitters',cat);resolveTop(g);const artifact=enter(g,'Sol Ring');artifact.type_line='Artifact Enchantment';enter(g,'Sol Ring',1);assert.equal(combatStats(g,1,cat).power,4);transfer(g,artifact.instance,'exile',0);assert.equal(combatStats(g,1,cat).power,3);assert.equal(aura.attachedTo,cat.instance);
});
test('Arahbo: Ethereal Armor counts itself and grants first strike; Blackblade scales with its controller lands',()=>{
 const g=game(),cat=kitty(g),armor=castAura(g,'Ethereal Armor',cat);resolveTop(g);assert.equal(combatStats(g,0,cat).power,3);assert.ok(keywordSet(g,0,cat).has('first strike'));const blade=equip(g,'Blackblade Reforged',cat),land=enter(g,'Forest');assert.equal(combatStats(g,0,cat).power,4);transfer(g,land.instance,'hand',0);assert.equal(combatStats(g,0,cat).power,3);assert.equal(blade.attachedTo,cat.instance);assert.equal(armor.attachedTo,cat.instance);
});
test('Arahbo: Cat lords affect other controlled Cats and Kaheera applies its subtype union',()=>{
 const g=game(),king=enter(g,'King of the Pride'),cat=kitty(g),enemy=kitty(g,1),elemental=kitty(g,0,{type_line:'Creature — Elemental'}),human=kitty(g,0,{type_line:'Creature — Human'});assert.equal(combatStats(g,0,king).power,2);assert.equal(combatStats(g,0,cat).power,4);assert.equal(combatStats(g,1,enemy).power,2);const kaheera=enter(g,'Kaheera, the Orphanguard');assert.equal(combatStats(g,0,cat).power,5);assert.equal(combatStats(g,0,elemental).power,3);assert.equal(combatStats(g,0,human).power,2);assert.ok(keywordSet(g,0,elemental).has('vigilance'));assert.equal(combatStats(g,0,kaheera).power,5);
});
test('Arahbo: Feline Sovereign grants protection from Dogs only to other Cats',()=>{
 const g=game(),source=enter(g,'Feline Sovereign'),cat=kitty(g),dog=kitty(g,1,{type_line:'Creature — Dog'});assert.ok(protectedFrom(g,0,cat,dog));assert.equal(protectedFrom(g,0,source,dog),false);assert.equal(combatStats(g,0,cat).power,3);
});
test('Arahbo: Pride Sovereign counts other Cats; Kemba static boost requires an actual Equipment attachment',()=>{
 const g=game(),pride=enter(g,'Pride Sovereign'),cat=kitty(g);assert.equal(combatStats(g,0,pride).power,3);enter(g,'Kemba, Kha Enduring');assert.equal(combatStats(g,0,pride).power,4);g.stack=[];equip(g,'Shadowspear',cat);assert.equal(combatStats(g,0,cat).power,4);const aura=castAura(g,'Rancor',pride);resolveTop(g);assert.equal(combatStats(g,0,pride).power,6);assert.ok(aura.attachedTo);
});
test('Arahbo: equip costs and targets are paid and checked; Blackblade offers a separate legendary equip',()=>{
 const g=game(),cat=kitty(g),legend=enter(g,'Jazal Goldmane'),blade=enter(g,'Blackblade Reforged');addMana(g.players[0],{C:10});const abilities=activatedAbilities(g,0,blade);assert.equal(abilities.find(a=>a.id==='equip:legendary').manaCost,'{3}');assert.equal(abilities.find(a=>a.id==='equip').manaCost,'{7}');activateMana(g,blade.instance,'equip:legendary');assert.equal(triggerTargetOptions(g,g.stack[0]).some(t=>t.id===cat.instance),false);chooseTriggerTarget(g,g.stack[0].id,'card:'+legend.instance);resolveTop(g);assert.equal(blade.attachedTo,legend.instance);
});
test('Arahbo: Leonin Shikari grants instant-speed equip while it remains in play',()=>{
 const g=game(),cat=kitty(g),boots=enter(g,'Swiftfoot Boots');addMana(g.players[0],{C:3});g.active=1;const shikari=enter(g,'Leonin Shikari');assert.equal(activationError(g,0,boots,activatedAbilities(g,0,boots).find(a=>a.id==='equip')),'');activateMana(g,boots.instance,'equip');chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);resolveTop(g);assert.equal(boots.attachedTo,cat.instance);transfer(g,shikari.instance,'hand',0);assert.match(activationError(g,0,boots,activatedAbilities(g,0,boots).find(a=>a.id==='equip')),/sorcery/);
});
test('Arahbo: Puresteel grants additional equip zero with three artifacts, and it disappears with metalcraft',()=>{
 const g=game(),cat=kitty(g),paladin=enter(g,'Puresteel Paladin'),boots=enter(g,'Swiftfoot Boots'),ring=enter(g,'Sol Ring');assert.equal(activatedAbilities(g,0,boots).some(a=>a.id==='equip:granted-zero'),false);const stone=enter(g,'Mind Stone');g.stack=[];assert.ok(activatedAbilities(g,0,boots).some(a=>a.id==='equip:granted-zero'));activateMana(g,boots.instance,'equip:granted-zero');chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);resolveTop(g);assert.equal(boots.attachedTo,cat.instance);transfer(g,stone.instance,'hand',0);assert.equal(activatedAbilities(g,0,boots).some(a=>a.id==='equip:granted-zero'),false);assert.ok(paladin&&ring);
});
test('Arahbo: Sigarda grants flash to Auras/Equipment only and only for its controller',()=>{
 const g=game(),cat=kitty(g),aid=enter(g,"Sigarda's Aid"),rancor=hand(g,'Rancor'),boots=hand(g,'Swiftfoot Boots'),creature=hand(g,'King of the Pride');g.active=1;assert.equal(castingTiming(g,0,rancor),'');assert.equal(castingTiming(g,0,boots),'');assert.match(castingTiming(g,0,creature),/main phase/);transfer(g,aid.instance,'hand',0);assert.match(castingTiming(g,0,rancor),/main phase/);assert.ok(cat);
});
test('Arahbo: Bear Umbra grants a real attack trigger to the enchanted creature and untaps lands on resolution',()=>{
 const g=game(),cat=kitty(g),land=enter(g,'Forest'),aura=castAura(g,'Bear Umbra',cat);resolveTop(g);land.tapped=true;changeStep(g,4);advance(g,{automatic:false});setAttacker(g,cat.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,1);assert.equal(g.stack[0].source.instance,cat.instance);assert.equal(land.tapped,true);resolveTop(g);assert.equal(land.tapped,false);assert.equal(combatStats(g,0,cat).power,4);assert.ok(aura.attachedTo);
});
for(const zone of ['command','battlefield'])test('Arahbo: Eminence in '+zone+' targets another controlled Cat and waits for responses',()=>{
 const g=game(4),commander=hand(g,'Arahbo, Roar of the World');commander.commander=true;transfer(g,commander.instance,zone,0);const cat=kitty(g),enemy=kitty(g,1),human=kitty(g,0,{type_line:'Creature — Human'});changeStep(g,4);assert.equal(g.stack.length,1);const options=triggerTargetOptions(g,g.stack[0]);assert.ok(options.some(t=>t.id===cat.instance));for(const c of [commander,enemy,human])assert.equal(options.some(t=>t.id===c.instance),false);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);assert.equal(combatStats(g,0,cat).power,2);resolveTop(g);assert.equal(combatStats(g,0,cat).power,5);changeStep(g,11);assert.equal(combatStats(g,0,cat).power,2);
});
test('Arahbo: Eminence does not work from hand or graveyard and rechecks its source zone at resolution',()=>{
 for(const zone of ['hand','graveyard']){const g=game(),c=hand(g,'Arahbo, Roar of the World');if(zone!=='hand')transfer(g,c.instance,zone,0);kitty(g);changeStep(g,4);assert.equal(g.stack.length,0);}
 const g=game(),c=hand(g,'Arahbo, Roar of the World');transfer(g,c.instance,'command',0);const cat=kitty(g);changeStep(g,4);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);transfer(g,c.instance,'exile',0);resolveTop(g);assert.equal(combatStats(g,0,cat).power,2);
});
test('Arahbo: local and shared Aura casting use the same target, payment and attachment paths',()=>{
 for(const shared of [false,true]){let g=game(),cat=kitty(g),rancor=hand(g,'Rancor');addMana(g.players[0],{G:1});const reduce=shared?reduceAction:reduceGameAction;g=reduce(g,{type:'cast',id:rancor.instance,options:{targets:['card:'+cat.instance]}},0).game;assert.equal(g.stack.length,1);g=reduce(g,{type:'pass'},0).game;g=reduce(g,{type:'pass'},1).game;assert.equal(g.players[0].zones.battlefield.find(c=>c.instance===rancor.instance).attachedTo,cat.instance);assert.equal(projectGame(g,1).players[0].zones.battlefield.find(c=>c.instance===rancor.instance).attachedTo,cat.instance);validateSession(g);}
});
test('Arahbo: its attack payment uses all three mana symbols and doubles live power without targeting the Cat',()=>{
 const g=game(),source=enter(g,'Arahbo, Roar of the World'),cat=kitty(g);changeStep(g,4);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);resolveTop(g);advance(g,{automatic:false});setAttacker(g,cat.instance,'player:1');confirmAttackers(g);assert.equal(g.stack.length,1);cat.temporaryKeywords=['shroud'];resolveTop(g);assert.equal(g.pendingEffect.step.op,'optionalPay');assert.equal(g.pendingEffect.step.cost,'{1}{G}{W}');cat.temporaryStats.power+=2;addMana(g.players[0],{C:1,G:1,W:1});resolveOracleChoice(g,['yes']);assert.equal(combatStats(g,0,cat).power,14);assert.equal(combatStats(g,0,cat).toughness,13);assert.ok(keywordSet(g,0,cat).has('trample'));assert.deepEqual(g.players[0].mana,[]);assert.equal(combatStats(g,0,source).power,5);
});
test('Arahbo: declining the attack payment leaves the Cat unchanged',()=>{
 const g=game(),source=enter(g,'Arahbo, Roar of the World'),cat=kitty(g);g.step=5;g.combat={id:'combat',turn:'1:0',owner:0,stage:'attackers',attackers:[],blocks:[],attackersConfirmed:false,defenders:[],confirmedDefenders:[],assignments:{},deathChoices:{},firstDone:false,normalDone:false};setAttacker(g,cat.instance,'player:1');confirmAttackers(g);resolveTop(g);resolveOracleChoice(g,['no']);assert.equal(combatStats(g,0,cat).power,2);assert.equal(keywordSet(g,0,cat).has('trample'),false);assert.ok(source);
});
test('Arahbo: Sram draws on an Aura cast before it resolves, independently of the spell',()=>{
 const g=game(),cat=kitty(g);enter(g,'Sram, Senior Edificer');g.players[0].zones.library=[card('Forest')];castAura(g,'Rancor',cat);assert.equal(g.stack.length,2);resolveTop(g);assert.equal(g.players[0].zones.hand.length,1);assert.equal(g.stack.length,1);assert.equal(combatStats(g,0,cat).power,2);
});
test('Arahbo: Puresteel offers its entry draw as an optional separate trigger',()=>{
 const g=game();enter(g,'Puresteel Paladin');g.players[0].zones.library=[card('Forest')];enter(g,'Sol Ring');assert.equal(g.stack.length,0);enter(g,'Swiftfoot Boots');assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,1);
});
test('Arahbo: Sigarda and Hammer attach the entering Equipment on a separate optional resolution',()=>{
 for(const name of ["Sigarda's Aid",'Hammer of Nazahn']){const g=game(),cat=kitty(g);const source=enter(g,name);if(name==='Hammer of Nazahn'){chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);resolveTop(g);resolveOracleChoice(g,['no']);}const boots=enter(g,'Swiftfoot Boots');assert.equal(g.stack.length,1);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);assert.equal(boots.attachedTo,undefined);resolveTop(g);resolveOracleChoice(g,['yes']);assert.equal(boots.attachedTo,cat.instance);assert.ok(keywordSet(g,0,cat).has('haste'));assert.ok(source);}
});
test('Arahbo: Kemba targets Equipment rather than its entering Cat, allowing a shrouded Cat to receive it',()=>{
 const g=game(),boots=enter(g,'Swiftfoot Boots'),kemba=enter(g,'Kemba, Kha Enduring');chooseTriggerTarget(g,g.stack[0].id,[]);resolveTop(g);const cat=kitty(g,0,{oracle_text:'Shroud'});assert.equal(g.stack.length,1);assert.ok(triggerTargetOptions(g,g.stack[0]).some(t=>t.id===boots.instance));chooseTriggerTarget(g,g.stack[0].id,'card:'+boots.instance);resolveTop(g);assert.equal(boots.attachedTo,cat.instance);assert.equal(combatStats(g,0,cat).power,3);assert.ok(kemba);
});
test('Arahbo: Snake Umbra grants an optional draw on damage to an opponent, including noncombat damage',()=>{
 const g=game(),cat=kitty(g),aura=castAura(g,'Snake Umbra',cat);resolveTop(g);g.players[0].zones.library=[card('Forest')];const events=dealDamagePackets(g,[{source:{owner:0,card:cat},target:{kind:'player',owner:1},amount:1}],{combat:false});stateBasedActions(g,{damageEvents:events});assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect.step.op,'optional');resolveOracleChoice(g,['yes']);assert.equal(g.players[0].zones.hand.length,1);assert.equal(combatStats(g,0,cat).power,3);assert.ok(aura);
});
test('Arahbo: a zone change between command and battlefield invalidates an old Eminence trigger',()=>{
 const g=game(),source=enter(g,'Arahbo, Roar of the World'),cat=kitty(g);changeStep(g,4);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);transfer(g,source.instance,'command',0);resolveTop(g);assert.equal(combatStats(g,0,cat).power,2);
});
test('Arahbo: Eminence has no response window when there is no legal other Cat',()=>{
 const g=game(),source=enter(g,'Arahbo, Roar of the World');changeStep(g,4);assert.equal(g.stack.length,0);assert.ok(source);
});
test('Arahbo: a negative-power Cat gets zero additional stats from the optional payment but still gains trample',()=>{
 const g=game(),source=enter(g,'Arahbo, Roar of the World'),cat=kitty(g,0,{power:'-2',toughness:'4'});changeStep(g,4);chooseTriggerTarget(g,g.stack[0].id,'card:'+cat.instance);resolveTop(g);advance(g,{automatic:false});cat.temporaryStats={power:0,toughness:0};setAttacker(g,cat.instance,'player:1');confirmAttackers(g);resolveTop(g);addMana(g.players[0],{C:1,G:1,W:1});resolveOracleChoice(g,['yes']);assert.equal(combatStats(g,0,cat).power,-2);assert.ok(keywordSet(g,0,cat).has('trample'));assert.ok(source);
});
for(const [name,cost] of [['Hammer of Nazahn',4],['Sword of the Animist',2],['Blackblade Reforged',7],['Shadowspear',2],['Lightning Greaves',0],['Skullclamp',1]])test('Arahbo: '+name+' pays its normal equip cost and legally attaches to a creature',()=>{
 const g=game(),recipient=kitty(g),equipment=enter(g,name);g.stack=[];delete g.priority;addMana(g.players[0],{C:10});activateMana(g,equipment.instance,'equip');chooseTriggerTarget(g,g.stack.at(-1).id,'card:'+recipient.instance);resolveTop(g);assert.equal(equipment.attachedTo,recipient.instance);if(name==='Hammer of Nazahn')assert.ok(keywordSet(g,0,recipient).has('indestructible'));assert.equal(manaTotals(g.players[0]).C,10-cost);
});
test('Arahbo: equip without a legal creature is rejected before spending mana',()=>{
 const g=game(),equipment=enter(g,'Shadowspear');addMana(g.players[0],{C:2});assert.throws(()=>activateMana(g,equipment.instance,'equip'),/No legal creature/);assert.equal(manaTotals(g.players[0]).C,2);assert.equal(g.stack.length,0);
});
test('Arahbo: Shadowspear removes opponents’ hexproof/indestructible; a later explicit grant works and cleanup restores printed abilities',()=>{
 const g=game(),spear=enter(g,'Shadowspear'),opponent=kitty(g,1,{oracle_text:'Hexproof\nIndestructible'}),mine=kitty(g,0,{oracle_text:'Hexproof'});addMana(g.players[0],{C:1});activateMana(g,spear.instance,'action:1');resolveTop(g);assert.equal(keywordSet(g,1,opponent).has('hexproof'),false);assert.equal(keywordSet(g,1,opponent).has('indestructible'),false);assert.equal(keywordSet(g,0,mine).has('hexproof'),true);
 const spell=hand(g,'Heroic Intervention',1);addMana(g.players[1],{G:1,C:1});castSpell(g,spell.instance);resolveTop(g);assert.equal(keywordSet(g,1,opponent).has('hexproof'),true);assert.equal(keywordSet(g,1,opponent).has('indestructible'),true);changeStep(g,11);assert.equal(opponent.lostKeywords,undefined);assert.equal(keywordSet(g,1,opponent).has('hexproof'),true);
});
test('Arahbo: Kemba’s paid token ability creates an unequipped 2/2 Cat and its entry attachment is a separate trigger',()=>{
 const g=game(),kemba=enter(g,'Kemba, Kha Enduring');resolveTop(g);addMana(g.players[0],{W:2,C:3});activateMana(g,kemba.instance,'action:2');resolveTop(g);const token=g.players[0].zones.battlefield.find(c=>c.token);assert.ok(token);assert.equal(combatStats(g,0,token).power,2);assert.equal(g.stack.length,1);resolveTop(g);assert.equal(g.pendingEffect,undefined);
});
test('Arahbo: Kaheera in the supplied main deck is a normal spell with vigilance and no chosen companion action',()=>{
 const g=game(),kaheera=hand(g,'Kaheera, the Orphanguard');assert.equal(kaheera.role,'signature');addMana(g.players[0],{G:3});castSpell(g,kaheera.instance);resolveTop(g);assert.ok(keywordSet(g,0,kaheera).has('vigilance'));assert.equal(g.pendingEffect,undefined);assert.equal(activatedAbilities(g,0,kaheera).length,0);assert.equal(g.players[0].zones.hand.length,0);
});
