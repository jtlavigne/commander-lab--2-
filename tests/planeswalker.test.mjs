import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {loyaltyCostSymbol} from '../ability-effects.mjs';
import assert from 'node:assert/strict';
import {loyaltyAbilities,defaultAbilityPositions,detectLoyaltyPositions,payLoyaltyCost} from '../planeswalker.mjs';
import {newGame,validateSession,endTurn,transfer} from '../engine.mjs';
import {availableLoyaltyAbilities,getLoyaltyAbility,loyaltyStatus,activateLoyaltyCost,applyLoyaltyPermission,loyaltyTurn} from '../planeswalker.mjs';
import {activateLoyaltyAction,activateManaLoyalty,passPriority,prioritySeat,resolveProliferate,activateMana} from '../casting.mjs';
import {addMana,activatedAbilities,manaAbilities} from '../mana.mjs';
const walker=()=>({instance:'walker',name:'Walker',type_line:'Planeswalker',loyalty:'4',face:0,counters:{loyalty:4},oracle_text:'Creatures you control have vigilance.\n+2: Draw a card.\n0: Scry 1.\n−3: Destroy target creature.\n−X: Draw X cards.'});
const importedGrants=JSON.parse(readFileSync(new URL('./fixtures/loyalty-grants.json',import.meta.url),'utf8'));
test('loyalty costs use active-face Oracle paragraphs and preserve printed order',()=>{
 assert.deepEqual(loyaltyAbilities(walker()).map(a=>[a.cost,a.variable,a.delta]),[['+2',false,2],['0',false,0],['-3',false,-3],['-X',true,null]]);
 assert.equal(loyaltyAbilities({...walker(),faceDown:true}).length,0);assert.equal(loyaltyAbilities({...walker(),type_line:'Enchantment'}).length,0);
 const card={...walker(),face:1,card_faces:[{type_line:'Creature',oracle_text:'Flying'},{type_line:'Planeswalker',oracle_text:'+1: Draw a card.'}]};assert.equal(loyaltyAbilities(card)[0].cost,'+1');
});
test('loyalty buttons pay numeric, zero and variable costs without resolving effects',()=>{
 const card=walker();payLoyaltyCost(card,0);assert.equal(card.counters.loyalty,6);payLoyaltyCost(card,1);assert.equal(card.counters.loyalty,6);payLoyaltyCost(card,2);assert.equal(card.counters.loyalty,3);payLoyaltyCost(card,3,2);assert.equal(card.counters.loyalty,1);
 const before=structuredClone(card);assert.throws(()=>payLoyaltyCost(card,2),/Not enough loyalty/);assert.deepEqual(card,before);assert.throws(()=>payLoyaltyCost(card,3,-1));assert.throws(()=>payLoyaltyCost(card,3,.5));
 payLoyaltyCost(card,3,1);assert.equal(card.counters.loyalty,0);
 assert.throws(()=>payLoyaltyCost(card,30),/not found/);
});
test('positive variable loyalty costs are supported',()=>{
 const card={...walker(),oracle_text:'+X: Test.'};payLoyaltyCost(card,0,5);assert.equal(card.counters.loyalty,9);
});
test('fallback positions account for static text and preserve ability order',()=>{
 const positions=defaultAbilityPositions(walker());assert.equal(positions.length,4);for(let i=0;i<positions.length;i++){assert.ok(positions[i].x>0&&positions[i].x<1);assert.ok(positions[i].y>.625&&positions[i].y<.92);if(i)assert.ok(positions[i].y>positions[i-1].y);}
});
test('art alignment detects separate printed shields and rejects ambiguous art',()=>{
 const width=200,height=300,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const y of [190,220,250])for(let row=y;row<y+10;row++)for(let x=13;x<29;x++){const i=(row*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 const positions=detectLoyaltyPositions({data,width,height},3);assert.equal(positions.length,3);assert.ok(Math.abs(positions[0].y-194.5/height)<.001);assert.equal(detectLoyaltyPositions({data,width,height},2),null);
 assert.equal(detectLoyaltyPositions({data:new Uint8ClampedArray(width*height*4).fill(255),width,height},3),null);
});
test('manual printing alignment survives sessions; invalid coordinates are rejected',()=>{
 const g=newGame(),card=walker();card.loyaltyLayout={0:[{x:.12,y:.7}]};g.players[0].zones.battlefield=[card];assert.deepEqual(validateSession(structuredClone(g)).players[0].zones.battlefield[0].loyaltyLayout,card.loyaltyLayout);
 card.loyaltyLayout[0][0].y=NaN;assert.throws(()=>validateSession(structuredClone(g)));
});
const game=()=>{const g=newGame();g.step=3;g.responseMode='hold';g.players[0].zones.battlefield=[walker()];return g;};
const permanent=(instance,type_line,oracle_text,extra={})=>({instance,name:instance,type_line,oracle_text,counters:{},...extra});
const passAll=g=>{for(let i=0;i<4;i++)passPriority(g,prioritySeat(g));};
test('one loyalty activation is shared by all abilities and persists until a new turn',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];activateLoyaltyCost(g,0,c,0);const before=structuredClone(c);assert.throws(()=>activateLoyaltyCost(g,0,c,1),/activation limit/);assert.deepEqual(c,before);c.counters.loyalty=20;assert.equal(loyaltyStatus(g,0,c).remaining,0);
 const restored=validateSession(structuredClone(g));assert.equal(loyaltyStatus(restored,0,restored.players[0].zones.battlefield[0]).used,1);g.step=9;assert.equal(loyaltyStatus(g,0,c).remaining,0);for(let i=0;i<4;i++)endTurn(g);g.step=3;assert.equal(loyaltyStatus(g,0,c).used,0);activateLoyaltyCost(g,0,c,1);assert.equal(loyaltyStatus(g,0,c).used,1);
});
test('failed and cancelled choices do not consume an activation; different planeswalkers are independent',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];assert.throws(()=>activateLoyaltyCost(g,0,c,3,10),/Not enough loyalty/);assert.equal(loyaltyStatus(g,0,c).used,0);activateLoyaltyCost(g,0,c,1);const other={...walker(),instance:'other'};g.players[0].zones.battlefield.push(other);activateLoyaltyCost(g,0,other,0);assert.equal(loyaltyStatus(g,0,other).used,1);
});
test('control changes and transformations preserve usage; leaving and reentering creates a fresh allowance',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];activateLoyaltyCost(g,0,c,0);transfer(g,c.instance,'battlefield',1);assert.equal(loyaltyStatus(g,1,c).used,1);c.face=1;assert.equal(loyaltyStatus(g,1,c).used,1);transfer(g,c.instance,'exile',1);transfer(g,c.instance,'battlefield',0);assert.equal(loyaltyStatus(g,0,c).used,0);
});
test('static permission limits use the highest limit and do not stack identical twice-per-turn effects',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0],text='You may activate the loyalty abilities of planeswalkers you control twice each turn rather than only once.';p.zones.battlefield.push(permanent('Permission A','Enchantment',text),permanent('Permission B','Enchantment',text));assert.equal(loyaltyStatus(g,0,c).limit,2);activateLoyaltyCost(g,0,c,0);activateLoyaltyCost(g,0,c,1);assert.throws(()=>activateLoyaltyCost(g,0,c,1),/activation limit/);transfer(g,'Permission A','graveyard',0);transfer(g,'Permission B','graveyard',0);assert.equal(loyaltyStatus(g,0,c).limit,1);
});
test('enchanted permissions and class levels affect only the attached permanent',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0],other={...walker(),instance:'other'};p.zones.battlefield.push(other,permanent('Aura','Enchantment — Aura','You may activate loyalty abilities of enchanted planeswalker twice each turn rather than only once.',{loyaltyAttachment:c.instance}));assert.equal(loyaltyStatus(g,0,c).limit,2);assert.equal(loyaltyStatus(g,0,other).limit,1);
 p.zones.battlefield.push(permanent('Class','Enchantment — Aura Class','{1}: Level 2\nOther text.\n{2}: Level 3\nYou may activate loyalty abilities of enchanted planeswalker three times each turn rather than only once.',{loyaltyAttachment:c.instance}));assert.equal(loyaltyStatus(g,0,c).limit,2);p.zones.battlefield.at(-1).classLevel=3;assert.equal(loyaltyStatus(g,0,c).limit,3);transfer(g,c.instance,'graveyard',0);transfer(g,c.instance,'battlefield',0);assert.equal(loyaltyStatus(g,0,c).limit,1,'An aura must not reattach itself when its former target returns');
});
test('resolved additional-activation effects add permissions for current and later planeswalkers',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0],text='For each planeswalker you control, you may activate one of its loyalty abilities once this turn as though none of its loyalty abilities have been activated this turn.';activateLoyaltyCost(g,0,c,0);applyLoyaltyPermission(g,0,text);applyLoyaltyPermission(g,0,text);assert.equal(loyaltyStatus(g,0,c).limit,3);activateLoyaltyCost(g,0,c,1);activateLoyaltyCost(g,0,c,1);assert.throws(()=>activateLoyaltyCost(g,0,c,1),/activation limit/);
 const later={...walker(),instance:'later'};p.zones.battlefield.push(later);assert.equal(loyaltyStatus(g,0,later).limit,3);endTurn(g);assert.equal(loyaltyStatus(g,0,later).limit,1);
});
test('a paid Chain Veil-style ability grants its permission only after stack resolution',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0],veil=permanent('Veil','Artifact','{4}, {T}: For each planeswalker you control, you may activate one of its loyalty abilities once this turn as though none of its loyalty abilities have been activated this turn.');p.zones.battlefield.push(veil);addMana(p,{C:4});activateMana(g,veil.instance,activatedAbilities(g,0,veil)[0].id);assert.equal(loyaltyStatus(g,0,c).limit,1);passAll(g);assert.equal(loyaltyStatus(g,0,c).limit,2);validateSession(structuredClone(g));
});
test('battlefield-granted loyalty abilities apply by recipient and expire with their source',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0],original=c.oracle_text,gauntlet=permanent('Gauntlet','Artifact','Planeswalkers you control have “0: Proliferate.” and “−12: Take an extra turn after this one.”');p.zones.battlefield.push(gauntlet);const other={...walker(),instance:'opponent'};g.players[1].zones.battlefield.push(other);
 const abilities=availableLoyaltyAbilities(g,0,c);assert.equal(abilities.length,6);assert.equal(availableLoyaltyAbilities(g,1,other).length,4);assert.equal(c.oracle_text,original);const granted=abilities.find(a=>a.grantedBy&&a.cost==='0');assert.equal(getLoyaltyAbility(g,0,c,granted.key).text,'Proliferate.');
 activateLoyaltyAction(g,c.instance,granted.key);assert.equal(c.counters.loyalty,4);assert.equal(loyaltyStatus(g,0,c).used,1);transfer(g,gauntlet.instance,'graveyard',0);assert.equal(availableLoyaltyAbilities(g,0,c).length,4);assert.throws(()=>activateLoyaltyCost(g,0,c,0),/activation limit/);passAll(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[c.instance]);assert.equal(c.counters.loyalty,5);
});
test('generic ability grants are not tied to a card name or only to planeswalkers',()=>{
 const g=game(),p=g.players[0],creature=permanent('Creature','Creature','');p.zones.battlefield.push(creature,permanent('Any source','Enchantment','Creatures you control have “+2: Draw a card.”'));const ability=availableLoyaltyAbilities(g,0,creature)[0];assert.equal(ability.cost,'+2');activateLoyaltyCost(g,0,creature,ability.key);assert.equal(creature.counters.loyalty,2);assert.throws(()=>activateLoyaltyCost(g,0,creature,ability.key),/activation limit/);
});
test('mana loyalty uses the same allowance and rejected production choices do not change loyalty',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];c.oracle_text='+1: Add one mana of any color.';const before=structuredClone(c);assert.throws(()=>activateManaLoyalty(g,c.instance,0,0,{color:'C'}),/allowed mana color/);assert.deepEqual(c,before);activateManaLoyalty(g,c.instance,0,0,{color:'G'});assert.equal(loyaltyStatus(g,0,c).used,1);passAll(g);assert.throws(()=>activateManaLoyalty(g,c.instance,0,0,{color:'G'}),/activation limit/);
});
test('instant-speed loyalty still uses only one activation per turn',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];c.oracle_text="You may activate loyalty abilities of Walker on any player's turn any time you could cast an instant.\n+1: Draw a card.";g.active=1;g.step=6;activateLoyaltyCost(g,0,c,0);assert.throws(()=>activateLoyaltyCost(g,0,c,0),/activation limit/);endTurn(g);g.step=6;assert.equal(loyaltyStatus(g,0,c).used,0);
});
test('invalid saved loyalty counters and permissions are rejected',()=>{
 const g=game(),c=g.players[0].zones.battlefield[0];c.loyaltyActivations={turn:loyaltyTurn(g),used:-1};assert.throws(()=>validateSession(structuredClone(g)));delete c.loyaltyActivations;g.loyaltyEffects=[{turn:loyaltyTurn(g),owner:0,extra:Infinity,limit:0}];assert.throws(()=>validateSession(structuredClone(g)));
});
test('granted mana-producing loyalty cannot bypass turn limits through the normal mana ability path',()=>{
 const g=game(),p=g.players[0],c=p.zones.battlefield[0];p.zones.battlefield.push(permanent('Grant','Artifact','Planeswalkers you control have “+1: Add {G}.”'));const granted=availableLoyaltyAbilities(g,0,c).find(a=>a.grantedBy);assert.ok(granted);assert.equal(manaAbilities(g,0,c).length,0);assert.equal(activatedAbilities(g,0,c).length,0);activateManaLoyalty(g,c.instance,granted.key);passAll(g);assert.throws(()=>activateManaLoyalty(g,c.instance,granted.key),/activation limit/);
});
test('one continuous source can supply mana and other activated abilities through the shared provider',()=>{
 const g=game(),p=g.players[0],creature=permanent('Recipient','Creature','');p.zones.battlefield.push(creature,permanent('Mixed grant','Enchantment','Creatures you control have “{T}: Add {G}.” and “{1}, {T}: Draw a card.”'));assert.equal(manaAbilities(g,0,creature).length,1);const actions=activatedAbilities(g,0,creature);assert.equal(actions.length,2);assert.equal(actions.filter(a=>a.usesStack).length,1);addMana(p,{C:1});activateMana(g,creature.instance,actions.find(a=>a.usesStack).id);assert.equal(g.stack.at(-1).text,'Draw a card.');assert.equal(creature.tapped,true);
});
test('actual imported Ichormoon Gauntlet grants bracketed loyalty abilities to Jace',()=>{
 const g=game(),p=g.players[0],jace=p.zones.battlefield[0];jace.name='Jace Beleren';jace.type_line='Legendary Planeswalker — Jace';jace.oracle_text='+2: Each player draws a card.\n−1: Target player draws a card.\n−10: Target player mills twenty cards.';p.zones.battlefield.push({...importedGrants.gauntlet,instance:'gauntlet',counters:{}});
 const granted=availableLoyaltyAbilities(g,0,jace).filter(a=>!a.printed);assert.deepEqual(granted.map(a=>a.cost),['0','-12']);assert.deepEqual(granted.map(a=>a.text),['Proliferate','Take an extra turn after this one.']);activateLoyaltyAction(g,jace.instance,granted[0].key);passAll(g);assert.equal(g.pendingEffect.kind,'proliferate');resolveProliferate(g,[jace.instance]);assert.equal(jace.counters.loyalty,5);assert.equal(loyaltyStatus(g,0,jace).remaining,0);
});
test('loyalty symbol normalization covers printed and quoted bracketed costs without creating mana activations',()=>{
 for(const [input,expected] of [['0','0'],['[0]','0'],['[−12]','-12'],['[–12]','-12'],['[-12]','-12'],['[+1]','+1'],['[−X]','-X'],['+X','+X']])assert.equal(loyaltyCostSymbol(input),expected);
 for(const invalid of ['[0','0]','{0}','{T}','[[0]]'])assert.equal(loyaltyCostSymbol(invalid),null);
 const g=game(),p=g.players[0],c=p.zones.battlefield[0];p.zones.battlefield.push(permanent('Source','Artifact','Planeswalkers you control have "[+1]: Add {G}." and "[−X]: Scry X."'));const granted=availableLoyaltyAbilities(g,0,c).filter(a=>a.grantedBy);assert.deepEqual(granted.map(a=>a.cost),['+1','-X']);assert.equal(manaAbilities(g,0,c).length,0);assert.equal(activatedAbilities(g,0,c).length,0);
});
