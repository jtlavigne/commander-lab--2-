import {automaticFor} from '../turn-settings.mjs';
import {publicManifest} from '../face-down-state.mjs';
import {createHash} from 'node:crypto';
export const PROTOCOL=1;
export const MAX_PACKET=8*1024*1024;
const forbidden=new Set(['__proto__','prototype','constructor']);
const local=new Set(['localImages','artworkVersion','artworkError','loyaltyLayout']);
const metadata=new Set(['id','oracle_id','name','mana_cost','cmc','type_line','oracle_text','power','toughness','loyalty','defense','colors','color_identity','keywords','layout','card_faces','image_uris','scryfall_uri','rulings_uri','legalities','requested_name','quantity','role']);
export function cleanData(value){
 if(Array.isArray(value))return value.map(cleanData);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k,v])=>!local.has(k)&&!forbidden.has(k)&&v!==undefined).map(([k,v])=>[k,cleanData(v)]));
 return value;
}
export function stable(value){return JSON.stringify(sort(value));}
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
export const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
export function diff(before,after,path=[]){
 if(Object.is(before,after))return [];
 if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)!==Array.isArray(after)||Array.isArray(after)&&before.length!==after.length)return [{op:'set',path,value:after}];
 const out=[];for(const key of Object.keys(before))if(!Object.hasOwn(after,key))out.push({op:'delete',path:[...path,key]});
 for(const key of Object.keys(after))out.push(...diff(before[key],after[key],[...path,key]));return out;
}
export function applyPatch(before,changes){
 if(!Array.isArray(changes)||changes.length>20000)throw Error('Invalid update.');let result=structuredClone(before);
 for(const change of changes){if(!change||!['set','delete'].includes(change.op)||!Array.isArray(change.path)||change.path.length>60||change.path.some(k=>typeof k!=='string'||forbidden.has(k)))throw Error('Invalid update path.');
  if(!change.path.length){if(change.op!=='set')throw Error('Invalid root update.');result=structuredClone(change.value);continue;}
  let parent=result;for(const key of change.path.slice(0,-1)){if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key))throw Error('Missing update path.');parent=parent[key];}
  if(!parent||typeof parent!=='object')throw Error('Missing update parent.');const key=change.path.at(-1);if(change.op==='delete')delete parent[key];else parent[key]=structuredClone(change.value);
 }return result;
}
const hidden=card=>({instance:card.instance,name:'Hidden card',type_line:'',faceDown:true,face:0,tapped:false,counters:{},hidden:true});
export function projectGame(game,seat,{log=[],automatic=false,epoch=0}={}){
 const view=cleanData(game);delete view.inactivePlayers;delete view.departedCards;view.log=[...log];view.networkSeat=seat;view.networkOptions={automatic:automaticFor(game,seat,automatic)};view.networkEpoch=epoch;
 const owned=game.players.flatMap((p,owner)=>Object.values(p.zones).flat().map(card=>({card,owner}))).concat(game.stack.filter(e=>e.card).map(e=>({card:e.card,owner:e.owner})));
 view.networkCommanderColors=game.players.map((_,owner)=>[...new Set(owned.filter(e=>e.card.commander&&(e.card.ownerSeat??e.owner)===owner).flatMap(e=>e.card.color_identity||[]))]);
 const pending=game.pendingEffect,choice=pending?.kind==='oracle-choice'&&pending.owner===seat?pending.step:null;
 if(view.pendingEffect?.kind==='oracle-choice'&&view.pendingEffect.step.op==='secretNumber'){view.pendingEffect.step.submitted=Object.keys(view.pendingEffect.step.values||{}).map(Number);delete view.pendingEffect.step.values;}
 for(const [owner,p] of view.players.entries()){
  // Legality details can name cards still concealed in this player's deck.
  if(owner!==seat&&view.lobby?.decks?.[owner])delete view.lobby.decks[owner].identityNotes;
  const handReveal=pending?.kind==='oracle-choice'&&pending.owner===seat&&pending.step.op==='viewHand'&&pending.step.target===owner;if(owner!==seat&&!handReveal)p.zones.hand=p.zones.hand.map((card,index)=>({...hidden(card),instance:'concealed-hand-'+owner+'-'+index}));
  const revealed=owner===seat&&choice&&(choice.op==='search'||['iterationHand','iterationBottom','scry','orderTop','surveil','selectLook','orderBottomLibrary'].includes(choice.op));
  // Never send stable card IDs for concealed libraries: otherwise a client
  // could track a previously revealed card through a shuffle.
  p.zones.library=p.zones.library.map((card,index)=>(revealed&&(choice.op==='search'||choice.ids.includes(card.instance))||pending?.revealed?.owner===owner&&pending.revealed.ids.includes(card.instance))?card:{...hidden(card),instance:'concealed-library-'+owner+'-'+index});
  p.zones.battlefield=p.zones.battlefield.map(card=>owner!==seat&&card.faceDown?{...(card.manifested?publicManifest(card):hidden(card)),tapped:card.tapped,tablePosition:card.tablePosition,ownerSeat:card.ownerSeat,battlefieldId:card.battlefieldId}:card);
 }
 if(pending&&pending.owner!==seat)view.pendingEffect={kind:'remote-choice',owner:pending.owner,name:pending.name,...(pending.revealed?{revealed:cleanData(pending.revealed)}:{})};
 for(const entry of view.stack){if(entry.owner!==seat){if(entry.card?.faceDown)entry.card=hidden(entry.card);if(entry.source?.faceDown)entry.source=hidden(entry.source);}}
 return view;
}
export function compactView(view){
 const assets={};function walk(value){
  if(Array.isArray(value))return value.map(walk);
  if(value&&typeof value==='object'){
   if(typeof value.instance==='string'&&typeof value.name==='string'&&!value.hidden){const definition=Object.fromEntries(Object.entries(value).filter(([k])=>metadata.has(k))),asset=digest(definition);assets[asset]=definition;return {...Object.fromEntries(Object.entries(value).filter(([k])=>!metadata.has(k)).map(([k,v])=>[k,walk(v)])),asset};}
   return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v)]));
  }return value;
 }return {state:walk(view),assets};
}
export function expandView(state,assets){
 function walk(value){if(Array.isArray(value))return value.map(walk);if(value&&typeof value==='object'){const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v)]));if(out.asset){if(!assets[out.asset])throw Error('Missing card definition.');const definition=assets[out.asset];delete out.asset;return {...definition,...out};}return out;}return value;}return walk(state);
}
