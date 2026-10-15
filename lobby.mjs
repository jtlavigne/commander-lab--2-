import {mulliganSettings,beginOpeningHands} from './opening-hand.mjs';
import {newGame,resetGame,ZONES} from './engine.mjs';

export const FORMATS={
 commander:{name:'Commander / EDH',life:40,size:100,singleton:true,commander:true,legality:'commander'},
 standard:{name:'Standard',life:20,min:60,copies:4,legality:'standard'},
 brawl:{name:'Standard Brawl',life:25,size:60,singleton:true,commander:true,legality:'standard'},
 historicbrawl:{name:'Brawl (100 cards)',life:25,size:100,singleton:true,commander:true,legality:'brawl'},
 modern:{name:'Modern',life:20,min:60,copies:4,legality:'modern'},
 twoheaded:{name:'Two-Headed Giant (manual teams)',life:30,min:60,copies:4,manual:true},
 freeform:{name:'Freeform',life:40}
};
export const LOBBY_ACTIONS=new Set(['lobbySettings','lobbyReady','lobbyRecheck','lobbyAcknowledge','lobbyStart']);
const IDENTITY_COLORS=['W','U','B','R','G'];
const COLOR_NAMES={W:'white',U:'blue',B:'black',R:'red',G:'green'};
const hasIdentity=card=>Array.isArray(card.color_identity)&&card.color_identity.every(c=>IDENTITY_COLORS.includes(c));
const identityName=colors=>IDENTITY_COLORS.filter(c=>colors.has(c)).map(c=>COLOR_NAMES[c]).join(' / ')||'colorless';
export function startingLife(g){const f=Object.hasOwn(FORMATS,g.lobby?.format)?FORMATS[g.lobby.format]:null;return !f?40:g.lobby.format==='brawl'&&g.players.length>2?30:f.life;}
export function validateLobby(g){
 const l=g.lobby;if(l===undefined)return;const n=g.players.length;mulliganSettings(l?.mulligan);
 if(!l||!['waiting','playing'].includes(l.status)||!Object.hasOwn(FORMATS,l.format)||typeof l.name!=='string'||!l.name.length||l.name.length>60||l.format==='twoheaded'&&n!==4)throw Error('Invalid lobby settings.');
 for(const key of ['ready','acknowledged'])if(!Array.isArray(l[key])||l[key].length!==n||l[key].some(v=>typeof v!=='boolean'))throw Error('Invalid lobby readiness.');
 if(!Array.isArray(l.decks)||l.decks.length!==n||l.decks.some(d=>d!==null&&(!d||!Number.isInteger(d.count)||d.count<0||d.count>500||!Array.isArray(d.issues)||d.issues.length>30||d.issues.some(s=>typeof s!=='string'||s.length>300))))throw Error('Invalid lobby deck report.');
 if(l.decks.some(d=>d?.identityNotes!==undefined&&(!Array.isArray(d.identityNotes)||d.identityNotes.length>500||d.identityNotes.some(s=>typeof s!=='string'||s.length>600))))throw Error('Invalid lobby color identity details.');
}
export function lobbyGame({count=4,format='commander',name='Commander Lab table',mulligan}={}){
 if(!Object.hasOwn(FORMATS,format))throw Error('Choose a supported format.');
 if(format==='twoheaded'&&count!==4)throw Error('Two-Headed Giant needs four players.');
 const g=newGame(count);g.lobby={status:'waiting',mulligan:mulliganSettings(mulligan),name:String(name).trim().slice(0,60)||'Commander Lab table',format,ready:Array(count).fill(false),acknowledged:Array(count).fill(false),decks:Array(count).fill(null)};return g;
}
export function deckReport(g,owner){
 const f=FORMATS[g.lobby.format],cards=[...ZONES.flatMap(z=>g.players[owner].zones[z]),...g.stack.filter(e=>e.owner===owner).map(e=>e.card)].filter(c=>c&&!c.token),issues=[],identityNotes=[],commanders=cards.filter(c=>c.commander);
 if(!cards.length)return {count:0,issues:['Import a deck.']};
 if(f.size&&cards.length!==f.size)issues.push('Deck must contain exactly '+f.size+' cards including commanders.');
 if(f.min&&cards.length<f.min)issues.push('Deck needs at least '+f.min+' cards.');
 if(f.commander){
  if(!commanders.length||commanders.length>2)issues.push('Choose one commander or a permitted pair.');
  const invalid=commanders.some(c=>!(/Legendary/.test(c.type_line||'')&&(/Creature/.test(c.type_line||'')||g.lobby.format!=='commander'&&/Planeswalker/.test(c.type_line||'')))&&!/can be your commander/i.test(c.oracle_text||'')&&!/Background/.test(c.type_line||''));
  if(invalid)issues.push('A selected commander needs eligibility review.');
  if(commanders.length===1&&/Background/.test(commanders[0].type_line||''))issues.push('A Background needs a commander with Choose a Background.');
  if(commanders.length===2){const [a,b]=commanders,text=c=>c.oracle_text||'',generic=c=>/^Partner(?: \(|$)/m.test(text(c)),withName=c=>text(c).match(/^Partner with (.+?)(?: \(|$)/m)?.[1],pair=generic(a)&&generic(b)||withName(a)===b.name&&withName(b)===a.name||/Choose a Background/.test(text(a))&&/Background/.test(b.type_line)||/Choose a Background/.test(text(b))&&/Background/.test(a.type_line)||/Friends forever/.test(text(a))&&/Friends forever/.test(text(b));if(!pair||g.lobby.format!=='commander')issues.push('Commander pairing needs host review.');}
  // Missing metadata is unknown, not an empty (colorless) identity. Scryfall's
  // whole-card identity already includes both faces and excludes reminder text.
  if(commanders.length){
   if(commanders.some(c=>!hasIdentity(c)))issues.push('Commander color identity data is unavailable; reload card data before checking colors.');
   else{
    const identity=new Set(commanders.flatMap(c=>c.color_identity));
    const outside=[...new Map(cards.filter(c=>hasIdentity(c)&&c.color_identity.some(color=>!identity.has(color))).map(c=>[c.name,c])).values()];
    if(outside.length){issues.push('Deck contains cards outside its commander color identity.');for(const c of outside)identityNotes.push(c.name+': '+identityName(new Set(c.color_identity))+'; commander identity: '+identityName(identity)+'.');}
   }
   if(cards.some(c=>!c.commander&&!hasIdentity(c)))issues.push('Some card color identity data is unavailable; reload card data before checking those cards.');
  }
 }else if(commanders.length)issues.push('This format does not use the command zone.');
 const counts=new Map();for(const c of cards)counts.set(c.name,(counts.get(c.name)||0)+1);
 if(f.singleton||f.copies)for(const [name,count] of counts){const c=cards.find(c=>c.name===name),t=c.oracle_text||'';if(/\bBasic\b/.test(c.type_line||'')||/A deck can have any number of cards named/i.test(t))continue;const allowed=t.match(/A deck can have up to (\w+) cards named/i)?.[1],words={two:2,three:3,four:4,five:5,six:6,seven:7,nine:9};if(count>(words[allowed]||Number(allowed)||f.copies||1)){issues.push('Deck exceeds the permitted copies of a nonbasic card.');break;}}
 if(f.legality){if(cards.some(c=>c.legalities?.[f.legality]&&c.legalities[f.legality]!=='legal'))issues.push('Deck includes cards not legal in the selected card pool.');if(cards.some(c=>!c.legalities?.[f.legality]))issues.push('Some card legality data is unavailable; host review required.');}
 if(f.manual)issues.push('Team turns, shared life and team combat require manual handling in this version.');
 return {count:cards.length,issues,...(identityNotes.length?{identityNotes}:{})};
}
export function refreshLobbyDeck(g,owner){if(g.lobby?.status!=='waiting')return;g.lobby.decks[owner]=deckReport(g,owner);g.lobby.ready[owner]=false;g.lobby.acknowledged[owner]=false;}
export function applyLobbyAction(g,a,actor,{host=true}={}){
 const l=g.lobby;if(l?.status!=='waiting')throw Error('No waiting lobby is open.');
 if(!['lobbyReady','lobbyRecheck'].includes(a.type)&&!host)throw Error('Only the host can change lobby options or start.');
 if(a.type==='lobbyRecheck')refreshLobbyDeck(g,actor);
 else if(a.type==='lobbyReady'){
  if(typeof a.ready!=='boolean')throw Error('Invalid ready state.');if(a.ready&&!l.decks[actor]?.count)throw Error('Import a deck before readying.');l.ready[actor]=a.ready;
 }else if(a.type==='lobbyAcknowledge'){
  if(!Number.isInteger(a.seat)||!g.players[a.seat]||typeof a.accepted!=='boolean')throw Error('Invalid deck acknowledgment.');l.acknowledged[a.seat]=a.accepted;
 }else if(a.type==='lobbySettings'){
  const count=a.count??g.players.length,format=a.format??l.format;if(![2,3,4].includes(count)||!Object.hasOwn(FORMATS,format)||format==='twoheaded'&&count!==4)throw Error('Choose valid player and format options.');
  if(count<g.players.length&&g.players.slice(count).some((_,i)=>l.decks[count+i]?.count))throw Error('Remove decks from unused seats before reducing player count.');
  const blank=newGame(count);g.players=g.players.slice(0,count);while(g.players.length<count)g.players.push(blank.players[g.players.length]);g.players.forEach(p=>p.damage=Array(count).fill(0));
  l.mulligan=mulliganSettings(a.mulligan??l.mulligan);l.name=typeof a.name==='string'?a.name.trim().slice(0,60)||l.name:l.name;l.format=format;l.ready=Array(count).fill(false);l.acknowledged=Array(count).fill(false);l.decks=g.players.map((_,i)=>deckReport(g,i));
 }else if(a.type==='lobbyStart'){
  if(!l.ready.every(Boolean))throw Error('Every player must import a deck and be ready.');
  if(l.decks.some((d,i)=>!d?.count||d.issues.length&&!l.acknowledged[i]))throw Error('The host must acknowledge every deck warning before starting.');
  const fresh=resetGame(g),f=FORMATS[l.format];fresh.lobby={...l,status:'playing'};beginOpeningHands(fresh);fresh.players.forEach(p=>p.life=l.format==='brawl'&&g.players.length>2?30:f.life);Object.keys(g).forEach(k=>delete g[k]);Object.assign(g,fresh);
 }else throw Error('Unknown lobby action.');
 return g;
}
