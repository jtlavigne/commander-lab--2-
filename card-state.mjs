// Starting values. Live creature characteristics and combat are in creature-rules/combat.
// Rules reference: https://magic.wizards.com/en/rules (306.5b, 310.4b, 714).
import {publicManifest} from './face-down-state.mjs';
import {entryTapState,entryLifePayment} from './life-effects.mjs';
export function cardFace(card){if(card.faceDown&&card.manifested)return publicManifest(card);const face={...card,...card.card_faces?.[card.face||0],...card.imprintProfile};if(card.animatedCreature&&!/\bCreature\b/.test(face.type_line||''))face.type_line=(face.type_line||'').replace(/\bArtifact\b/,'Artifact Creature');if(Number.isSafeInteger(card.linkedExileCount)&&/power and toughness are each equal to the number of cards exiled with it\./i.test(face.oracle_text||''))face.power=face.toughness=String(card.linkedExileCount);return face;}
const integer=value=>/^[+-]?\d+$/.test(String(value??''))&&Number.isSafeInteger(Number(value))?Number(value):null;
const words={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,twenty:20};
const quantity=value=>words[value.toLowerCase()]??integer(value);
export function manaValue(card,{x=0,onStack=false}={}){
 if(card.faceDown)return 0;
 if(card.layout==='split'&&!onStack)return Number(card.cmc)||0;
 const cost=cardFace(card).mana_cost;
 if(Number.isFinite(card.cmc)&&!['split','modal_dfc'].includes(card.layout))return card.cmc+(onStack?x*[...(cost||'').matchAll(/\{X\}/g)].length:0);
 if(cost===undefined||cost===''&&card.layout==='transform')return Number(card.cmc)||0;
 return [...(cost||'').matchAll(/\{([^}]+)\}/g)].reduce((n,[,symbol])=>n+(/^\d+$/.test(symbol)?Number(symbol):symbol==='X'?(onStack?x:0):/^[YZ]$/.test(symbol)?0:symbol.startsWith('2/')?2:1),0);
}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function creatureStats(card){
 if(card.faceDown&&!card.manifested)return null;
 const face=cardFace(card);if(!/\bCreature\b/.test(face.type_line||''))return null;
 const base=card.battlefieldStats?.face===(card.face||0)?card.battlefieldStats:{};
 let power=base.power??integer(face.power),toughness=base.toughness??integer(face.toughness),p=0,t=0;
 for(const [name,count] of Object.entries(card.counters||{})){
  const match=name.match(/^([+-]\d+)\/([+-]\d+)$/);if(match){p+=Number(match[1])*count;t+=Number(match[2])*count;}
 }
 return {power:power===null?(face.power??'?'):power+p,toughness:toughness===null?(face.toughness??'?'):toughness+t,basePower:power,baseToughness:toughness};
}
export function entryPlan(card,g,owner,{cast}={}){
 const face=cardFace(card),type=face.type_line||'',text=(face.oracle_text||'').replace(/^[A-Za-z ]+ \u2014 /gm,''),counters={},choices=[];
 if(card.faceDown)return {counters,choices};
 const ask=(key,label,suggested=0,min=0)=>{if(!choices.some(choice=>choice.key===key))choices.push({key,label,suggested,min});};
 const add=(name,count,variable=false)=>{
  name=name.toLowerCase().trim();if(variable||count===null){delete counters[name];ask('counter:'+name,'Starting '+name+' counters',count??0);}
  else if(!choices.some(choice=>choice.key==='counter:'+name))counters[name]=count;
 };
 if(/\bCreature\b/.test(type))for(const stat of ['power','toughness'])if(integer(face[stat])===null&&!(stat==='power'&&/power is equal to the number of creatures you control\./i.test(text))&&!/power and toughness are each equal to the number of (?:lands you control|cards in your hand)/i.test(text))ask(stat,'Base '+stat+' (printed '+(face[stat]??'?')+')',0,-999999);
 if(/\bPlaneswalker\b/.test(type)){
  const loyalty=integer(face.loyalty),reduction=/(?:^|\n)Compleated\b/i.test(text)?cast?.phyrexianLife||0:0;
  add('loyalty',loyalty===null?null:Math.max(0,loyalty-reduction));
 }
 if(/\bBattle\b/.test(type))add('defense',integer(face.defense));
 if(/\bSaga\b/.test(type))add('lore',1,/\bread ahead\b/i.test(text));
 // Match only this card's own entering instruction, never a target or another permanent.
 const names=[face.name,card.name?.split(' // ')[0]].filter(Boolean).map(escape);
 const self='(?:'+[...new Set(names),'[Tt]his (?:artifact|creature|enchantment|permanent|planeswalker|battle|land)'].join('|')+')';
 const clauses=text.matchAll(new RegExp('(?:^|\\n|\\. )'+self+' enters(?: the battlefield)?(?: tapped)? with ([^\\n.]+)','gi'));
 for(const [,clause] of clauses){
  // X announced while casting is already known; do not ask the player to
  // enter it again after resolution. More complex variable clauses still ask.
  const exactX=clause.match(/^X ([+\-]\d+\/[+\-]\d+|[a-z][a-z -]*?) counters? on it$/i);
  if(exactX&&cast){add(exactX[1],cast.x);continue;}
  if(/if a permanent left the battlefield under your control this turn$/i.test(clause)&&g){if(g.battlefieldDepartures?.turn===g.turn+':'+g.active&&g.battlefieldDepartures.counts[owner]>0)for(const match of clause.matchAll(/(an?|one|two|three|\d+) ([+-]\d+\/[+-]\d+) counters?/gi))add(match[2],quantity(match[1]));continue;}
  if(/for each time it was kicked$/i.test(clause)&&Number.isSafeInteger(card.castKicks)){for(const match of clause.matchAll(/(an?|one|two|three|\d+) ([a-z]+) counters?/gi))add(match[2],quantity(match[1])*card.castKicks);continue;}
  const variable=/\b(?:for each|equal to|if|unless|chosen|that many|number of|X)\b/i.test(clause);
  for(const match of clause.matchAll(/(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|twenty|X|a number of|that many|the chosen number of) ([+\-]\d+\/[+\-]\d+|[a-z][a-z -]*?) counters?\b/gi))add(match[2],quantity(match[1]),variable);
 }
 // These keyword abilities may be printed without reminder text.
 for(const [,keyword,count] of text.matchAll(/(?:^|\n)(Modular|Graft|Fading|Vanishing) (\d+|X)\b/gi))add({modular:'+1/+1',graft:'+1/+1',fading:'fade',vanishing:'time'}[keyword.toLowerCase()],count.toUpperCase()==='X'&&cast?cast.x:quantity(count));
 if(/(?:^|\n)Sunburst\b/i.test(text))add(/\bCreature\b/.test(type)?'+1/+1':'charge',cast?cast.colors.length:null);
 return {counters:Object.fromEntries(Object.entries(counters).filter(([,count])=>count>0)),choices};
}
export function initializePermanent(card,g,owner,options={}){
 delete card.battlefieldStats;delete card.entryChoices;delete card.entryLife;delete card.entryCondition;
 delete card.attachedTo;delete card.skipNextUntap;delete card.attackHistory;delete card.exertedTurn;
 delete card.imprintLink;delete card.imprintProfile;delete card.abilityUses;delete card.combatDamageHistory;
 delete card.armorChoice;delete card.animatedCreature;delete card.exileLinks;delete card.linkedExileCount;
 card.summoningSick=true;card.battlefieldId=crypto.randomUUID();
 const entry=entryTapState(card,g,owner,options);card.tapped=entry.tapped;if(entry.condition)card.entryCondition=entry.condition;
 const life=entryLifePayment(card);if(life){card.entryLife={amount:life,forcedTapped:card.tapped};card.tapped=true;}
 const plan=entryPlan(card,g,owner,options);card.counters=plan.counters;
 if(plan.choices.length)card.entryChoices=plan.choices;
}
export function applyEntryChoices(card,values){
 const pending=card.entryChoices||[];
 for(const choice of pending){const value=values[choice.key];if(!Number.isSafeInteger(value)||value<choice.min||Math.abs(value)>999999)throw Error('Enter a whole number for '+choice.label+'.');}
 for(const choice of pending){const value=values[choice.key];if(choice.key.startsWith('counter:')){const name=choice.key.slice(8);if(value)card.counters[name]=value;else delete card.counters[name];}
  else{card.battlefieldStats??={face:card.face||0};card.battlefieldStats[choice.key]=value;}}
 delete card.entryChoices;
}
