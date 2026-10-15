import {shuffle,draw,note} from './engine.mjs';

export const MULLIGAN_MODES={regular:'Regular (London)',extra:'Extra free mulligans',gentlemen:"Gentlemen's rule (unlimited free)"};
export const OPENING_ACTIONS=new Set(['openingMulligan','openingKeep','openingReady']);
export const openingPending=g=>g.opening?.status==='choosing';
export const decksReadyForOpening=g=>g.players.every(p=>Object.values(p.zones).flat().some(c=>!c.token&&!c.commander));
export function mulliganSettings(value={mode:'regular',extraFree:1}){
 if(!value||!Object.hasOwn(MULLIGAN_MODES,value.mode)||!Number.isSafeInteger(value.extraFree)||value.extraFree<0||value.extraFree>20)throw Error('Choose valid mulligan settings (0 to 20 extra free mulligans).');
 return {mode:value.mode,extraFree:value.extraFree};
}
// CR 103.5: multiplayer (>2 seats) and Brawl receive a free mulligan.
// House-rule extras are additional to that allowance; gentlemen's is unlimited.
export function freeMulligans(g){
 const options=mulliganSettings(g.lobby?.mulligan);
 return options.mode==='gentlemen'?Infinity:(g.players.length>2||['brawl','historicbrawl'].includes(g.lobby?.format)?1:0)+(options.mode==='extra'?options.extraFree:0);
}
export function bottomCount(g,owner){return Math.min(g.players[owner].zones.hand.length,Math.max(0,(g.opening?.players[owner].mulligans||0)-freeMulligans(g)));}
export function beginOpeningHands(g){
 g.opening={status:'choosing',round:0,players:g.players.map(()=>({mulligans:0,kept:false,ready:false,redraw:false}))};
 note(g,'Choose opening hands. Everyone must confirm ready before play.');
}
export function validateOpeningHands(g){
 const o=g.opening;if(o===undefined)return;
 if(!o||!['choosing','complete'].includes(o.status)||!Number.isSafeInteger(o.round)||o.round<0||!Array.isArray(o.players)||o.players.length!==g.players.length)throw Error('Invalid opening-hand state.');
 for(const p of o.players)if(!p||!Number.isSafeInteger(p.mulligans)||p.mulligans<0||['kept','ready','redraw'].some(k=>typeof p[k]!=='boolean')||p.ready&&!p.kept||p.redraw&&p.kept)throw Error('Invalid opening-hand player.');
 if((o.status==='complete')!==o.players.every(p=>p.ready))throw Error('Invalid opening-hand readiness.');
}
export function applyOpeningAction(g,a,owner){
 if(!openingPending(g))throw Error('Opening hands are already finished.');
 const state=g.opening.players[owner],player=g.players[owner];
 if(a.type==='openingReady'){
  if(state.ready)throw Error('This starting hand is already confirmed.');
  // Ready is the player's keep decision and confirmation in one command.
  // Reuse the London bottoming validation before changing readiness.
  if(!state.kept)applyOpeningAction(g,{type:'openingKeep',bottom:a.bottom},owner);
  state.ready=true;note(g,player.name+' is ready to play.');
  if(g.opening.players.every(p=>p.ready)){g.opening.status='complete';note(g,'All players are ready. '+g.players[g.active].name+' starts.');}
  return;
 }
 if(state.kept||state.redraw)throw Error('This opening-hand decision is already confirmed.');
 if(a.type==='openingMulligan'){
  if(state.mulligans-freeMulligans(g)>=7)throw Error('You must keep the zero-card hand.');
  state.redraw=true;
 }else if(a.type==='openingKeep'){
  const ids=a.bottom??[];
  if(!Array.isArray(ids)||ids.length!==bottomCount(g,owner)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!player.zones.hand.some(c=>c.instance===id)))throw Error('Select exactly the required cards from your hand to put on the bottom.');
  // Selection order is library order: the last selected card is bottommost.
  for(const id of ids){const index=player.zones.hand.findIndex(c=>c.instance===id);player.zones.library.push(...player.zones.hand.splice(index,1));}
  state.kept=true;note(g,player.name+' keeps '+player.zones.hand.length+' cards.');
 }else throw Error('Unknown opening-hand action.');
 // Finish a round before revealing anyone's next hand. Kept players take no
 // further mulligans; opening draws bypass draw triggers and turn-draw history.
 if(g.opening.players.every(p=>p.kept||p.redraw)&&g.opening.players.some(p=>p.redraw)){
  for(const [seat,p] of g.opening.players.entries())if(p.redraw){const zones=g.players[seat].zones;zones.library.push(...zones.hand);zones.hand=[];shuffle(zones.library);draw(g,seat,7,{opening:true});p.mulligans++;p.redraw=false;}
  g.opening.round++;note(g,'Mulligan round '+g.opening.round+' dealt.');
 }
}
