import {OPENING_ACTIONS} from '../opening-hand.mjs';
﻿import {ZONES,findCard} from '../engine.mjs';
import {turnController} from '../game-outcome.mjs';
import {blockController} from '../combat.mjs';
import {prioritySeat} from '../casting.mjs';
import {reduceGameAction} from '../game-actions.mjs';
import {cleanData} from './protocol.mjs';
import {castingController} from '../spell-rules.mjs';
import {LOBBY_ACTIONS} from '../lobby.mjs';

const seatActions=new Set(['librarySearch','automatic','responseMode','draw','life','playerStats','manaAdd','manaRemove','landSettings','pass','orderTriggers']);
const turnActions=new Set(['advance','endTurn','step','attacker','attackAll','confirmAttackers','damage']);
const hostActions=new Set(['reset']);
const cardZones={
 playLand:['hand','exile','graveyard'],cast:['hand','command','graveyard','exile','library'],activate:['battlefield','hand'],
 turnFaceUp:['battlefield'],loyalty:['battlefield'],loyaltyMana:['battlefield'],tap:['battlefield'],
 counterEdit:['battlefield'],stats:['battlefield'],entryValues:['battlefield'],
 entryLife:['battlefield'],entryTapped:['battlefield'],attacker:['battlefield'],
 blocker:['battlefield'],blockerReplace:['battlefield'],damageAssignment:['battlefield'],
 deathChoice:['battlefield'],manaSettings:['battlefield'],loyaltySettings:['battlefield'],
 move:ZONES,faceDown:ZONES,face:ZONES,libraryTop:ZONES,removeToken:[...ZONES,'stack']
};

const sharedActions=new Set([...OPENING_ACTIONS,...LOBBY_ACTIONS,...seatActions,...turnActions,...hostActions,...Object.keys(cardZones),
 'shuffle','redraw','untap','counter','oracleChoice','counterChoice','destructionChoice','proliferate','triggerTarget','manualResolved','confirmBlockers','token','copyToken','import']);

// Local hotseat and shared play use the same gameplay implementation.
// This adapter only enforces permissions and removes local-only packet data.
export function authorizeAction(g,a,actor,{host=false}={}){
 if(!sharedActions.has(a.type))throw Error('Unknown shared action.');
 if(!g.players[actor])throw Error('Seat unavailable.');
 if(a.type!=='move'&&a.owner!==undefined&&a.owner!==actor)throw Error('Each player controls their own seat.');
 if(turnActions.has(a.type)&&(['advance','endTurn','step'].includes(a.type)?turnController(g):g.active)!==actor)throw Error('Wait for the active player.');
 if(hostActions.has(a.type)&&!host)throw Error('Only the host can change table settings.');
 const zones=cardZones[a.type],found=zones&&findCard(g,a.id);
 if(zones&&(!found||(a.type==='cast'?castingController(g,found):['blocker','blockerReplace'].includes(a.type)?blockController(g,found.owner):found.owner)!==actor||!zones.includes(found.zone)))throw Error('You do not control that card.');
 switch(a.type){
  case 'counter':
   if(g.stack.length&&prioritySeat(g)!==actor)throw Error('Another player has priority.');break;
  case 'redraw':
   if(g.stack.length)throw Error('Resolve the stack first.');break;
  case 'move':
   if(found.zone==='library'&&!g.players[actor].librarySearch&&(a.to!=='hand'||g.players[actor].zones.library[0]?.instance!==a.id))throw Error('Draw from the top of your library.');
   if(a.to==='stack'||found.zone==='hand'&&a.to==='battlefield')throw Error('Use casting or Play land to pay costs.');
   if(a.owner!==undefined&&a.owner!==actor&&found.zone!=='battlefield')throw Error('Only battlefield control can be transferred.');
   break;
  case 'counterChoice':case 'oracleChoice':case 'destructionChoice':case 'proliferate':
   if(g.pendingEffect?.owner!==actor)throw Error('Another player is choosing.');break;
  case 'triggerTarget':
   if(g.stack.find(e=>e.id===a.id)?.owner!==actor)throw Error('Another player owns that ability.');break;
  case 'manualResolved':
   if(g.pendingEffect?.owner!==actor)throw Error('No manual effect for your seat.');break;
  case 'import':
   if(g.stack.length||g.pendingEffect||g.combat&&g.combat.stage!=='complete')throw Error('Finish pending play before importing.');
   break;
 }
}

export function canRebaseAction(g,a){
 if(a?.type==='life')return true;
 if(!['move','counterEdit'].includes(a?.type)||typeof a.expected?.battlefieldId!=='string')return false;
 const found=findCard(g,a.id);
 return found?.zone==='battlefield'&&found.card.battlefieldId===a.expected.battlefieldId&&(a.type!=='move'||a.to==='battlefield'&&a.owner===undefined);
}

export function reduceAction(original,action,actor,options={}){
 if(!action||typeof action.type!=='string'||JSON.stringify(action).length>2*1024*1024)throw Error('Invalid action.');
 const command=cleanData(action);
 authorizeAction(original,command,actor,options);
 // A library draw also records the draw-step action stamp.
 const found=command.type==='move'&&findCard(original,command.id);
 const normalized=found?.zone==='library'&&!original.players[actor].librarySearch?{type:'draw'}:command.type==='pass'?{...command,owner:actor}:command;
 const result=reduceGameAction(original,normalized,actor,{host:false,...options});
 // Public summaries omit private engine log text and card names.
 result.description=action.type==='reset'?'Host reset the game; decks kept.':original.players[actor].name+': '+action.type;
 return result;
}
