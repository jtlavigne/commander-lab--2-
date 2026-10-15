import {tokenTemplate} from './token-catalog.mjs';
import {OPENING_ACTIONS,openingPending,applyOpeningAction,beginOpeningHands,decksReadyForOpening} from './opening-hand.mjs';
import {validResponseMode} from './response-settings.mjs';
import {turnManifestFaceUp} from './face-down.mjs';
import {newGame,validateSession,ZONES,findCard,commandersFor,transfer,placeInLibrary,draw,shuffle,advance,endTurn,untap,changeStep,resolve,note,resetGame} from './engine.mjs';
import {playLand,castSpell,activateMana,activateManaLoyalty,activateLoyaltyAction,passPriority,prioritySeat,resolveProliferate,resolveTop,chooseEntryLife,chooseEntryTapped,counterTop,settlePriority} from './casting.mjs';
import {addMana,reverseManaTap,validateManaSettings} from './mana.mjs';
import {applyEntryChoices} from './card-state.mjs';
import {createTokens} from './tokens.mjs';
import {setAttacker,confirmAttackers,setBlocker,confirmBlockers,setDamageAssignment,applyCombatDamage,attackTargets,stateBasedActions,blockController,controlledBlockerSeat} from './combat.mjs';
import {attackError,attackTargetError} from './creature-rules.mjs';
import {chooseTriggerTarget,deathDestinations,orderTriggers} from './combat-effects.mjs';
import {resolveOracleChoice,resolveDestructionChoice,resolveCounterChoice} from './oracle-effects.mjs';
import {autoPassEmptySteps} from './phase-flow.mjs';
import {turnController} from './game-outcome.mjs';
import {LOBBY_ACTIONS,applyLobbyAction,refreshLobbyDeck} from './lobby.mjs';
const integer=(n,min=0,max=999999)=>{
 if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid whole-number value.');
 return n;
};
const text=(s,max=4000)=>{
 if(typeof s!=='string'||s.length>max)throw Error('Invalid text.');
 return s;
};

// Canonical games and commands are JSON data. Copy their containers directly:
// immutable strings (including cached image data) need no serialization/copy.
// This keeps local transactions from copying megabytes of art for every card.
function cloneGameData(value){
 if(Array.isArray(value))return value.map(cloneGameData);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cloneGameData(item)]));
 return value;
}

// Shared gameplay implementation. Transport authorization belongs to multiplayer/actions.mjs.
// Always reduce a clone so rejected commands cannot partially mutate the table.
export function reduceGameAction(original,action,actor,{automatic=false,host=true}={}){
 if(!action||typeof action.type!=='string')throw Error('Invalid action.');
 const g=cloneGameData(original),a=cloneGameData(action),owner=a.owner??actor,player=g.players[owner];
 if(!player)throw Error('Seat unavailable.');
 // Preference changes never advance another player's turn or pending choice.
 if(a.type==='automatic'){
  if(owner!==actor)throw Error('Each player controls their own seat.');
  if(typeof a.enabled!=='boolean')throw Error('Invalid automatic untap/draw setting.');
  player.automatic=a.enabled;validateSession(g);return {game:g,description:player.name+': automatic untap/draw '+(a.enabled?'on':'off')};
 }
 if(player.eliminated&&!['reset','advance','endTurn','step','responseMode'].includes(a.type))throw Error('This player has left the game.');
 if(g.result&&!['reset','responseMode'].includes(a.type))throw Error('This game has ended. Reset the game to play again.');
 const requireCard=(id,zones=[...ZONES,'stack'])=>{
  const found=findCard(g,id);
  if(!found||!zones.includes(found.zone))throw Error('Card is not in an eligible zone.');
  return found.card;
 };
 const description=player.name+': '+a.type;
 if(LOBBY_ACTIONS.has(a.type)){applyLobbyAction(g,a,owner,{host});validateSession(g);return {game:g,description};}
 if(OPENING_ACTIONS.has(a.type)){applyOpeningAction(g,a,owner);validateSession(g);return {game:g,description};}
 if(openingPending(g)&&!['reset','responseMode'].includes(a.type))throw Error('Finish opening hands and confirm ready before playing.');
 if(g.lobby?.status==='waiting'&&!['import','playerStats','responseMode'].includes(a.type))throw Error('Start the game from the lobby before playing.');
 if(g.pendingEffect?.kind==='counter-choice'&&!['counterChoice','reset','responseMode'].includes(a.type))throw Error('Finish counter replacement choices first.');
 // ---- Apply one command ----
 // These commands are shared by mouse, keyboard, controller and network input.
 switch(a.type){
  case 'librarySearch':{
   if(owner!==actor)throw Error('Each player controls their own seat.');
   if(typeof a.open!=='boolean'||a.shuffle!==undefined&&typeof a.shuffle!=='boolean')throw Error('Invalid library search.');
   if(a.open){
    if(g.pendingEffect?(g.pendingEffect.kind!=='combat-manual'||g.pendingEffect.owner!==actor):g.stack.length)throw Error('Finish the pending effect or use its search choices before manually searching.');
    player.librarySearch=true;
   }else{
    if(!player.librarySearch)throw Error('No manual library search is open.');
    delete player.librarySearch;if(a.shuffle!==false)shuffle(player.zones.library);
   }
   note(g,player.name+(a.open?' searches their library.':a.shuffle===false?' finishes searching.':' finishes searching and shuffles.'));
   validateSession(g);return {game:g,description:player.name+(a.open?': searching library.':a.shuffle===false?': search finished.':': search finished; library shuffled.')};
  }
  case 'advance':advance(g,{automatic});break;
  case 'endTurn':endTurn(g,{automatic});break;
  case 'step':changeStep(g,integer(a.step,0,11));break;
  case 'draw':draw(g,owner,integer(a.count??1,1,7));break;
  case 'shuffle':shuffle(player.zones.library);note(g,player.name+' shuffles their library.');break;
  case 'redraw':
   player.zones.library.push(...player.zones.hand);player.zones.hand=[];
   shuffle(player.zones.library);draw(g,owner,7,{opening:true});
   note(g,'Practice redraw: apply London mulligan bottoming manually.');break;
  case 'untap':
   if(g.step===0&&g.active===owner)untap(g,owner);
   else for(const card of player.zones.battlefield)reverseManaTap(g,card);
   break;
  case 'playLand':requireCard(a.id,['hand','exile','graveyard']);playLand(g,a.id,a.position);break;
  case 'cast':requireCard(a.id,['hand','command','graveyard','exile','library']);castSpell(g,a.id,a.options||{});break;
  case 'activate':requireCard(a.id,['battlefield','hand']);activateMana(g,a.id,a.ability,a.choice||{});break;
  case 'loyalty':requireCard(a.id,['battlefield']);activateLoyaltyAction(g,a.id,a.index,integer(a.x??0));break;
  case 'loyaltyMana':requireCard(a.id,['battlefield']);activateManaLoyalty(g,a.id,a.index,integer(a.x??0),a.choice||{});break;
  case 'pass':passPriority(g,a.owner??prioritySeat(g));break;
  case 'orderTriggers':orderTriggers(g,owner,a.ids);break;
  case 'counterChoice':resolveCounterChoice(g,text(a.key));break;
  case 'resolveNow':resolveTop(g);break;
  case 'resolveTo':resolve(g,a.to);break;
  case 'counter':if(!g.stack.length)throw Error('The stack is empty.');counterTop(g);break;
  case 'move':{const id=requireCard(a.id).instance;if(a.to==='library')placeInLibrary(g,id,a.owner??actor,a.libraryPosition??'top');else transfer(g,id,a.to,a.owner??actor,a.position);break;}
  case 'tap':{
   const card=requireCard(a.id,['battlefield']),controller=findCard(g,a.id).owner;
   if(card.tapped)reverseManaTap(g,card,{fromEffect:a.fromEffect===true||g.step===0&&g.active===controller});
   else card.tapped=true;
   note(g,(card.tapped?'Tapped ':'Untapped ')+card.name+(a.fromEffect?' (resolved effect)':''));break;
  }
  case 'turnFaceUp':requireCard(a.id,['battlefield']);turnManifestFaceUp(g,a.id);stateBasedActions(g);break;
  case 'faceDown':{
   const c=requireCard(a.id),zone=findCard(g,a.id).zone;
   if(c.manifested)throw Error('Use Turn face up and pay its mana cost.');
   if(c.commander||['command','graveyard','exile'].includes(zone))throw Error('This card must stay face up.');
   c.faceDown=!c.faceDown;break;
  }
  case 'face':{
   const c=requireCard(a.id);
   if(c.manifested)throw Error('Use Turn face up and pay its mana cost.');
   if(c.commander)throw Error('The commander stays on its front face.');
   const n=c.localImages?.length||c.card_faces?.length||1;c.face=((c.face||0)+1)%n;break;
  }
  case 'counterEdit':{
   const c=requireCard(a.id),key=text(a.counter,80).trim();
   if(!key)throw Error('Choose a counter.');
   const n=integer((c.counters?.[key]||0)+integer(a.delta,-999999,999999));
   c.counters??={};if(n)c.counters[key]=n;else delete c.counters[key];
   note(g,c.name+': '+(a.delta>0?'+':'')+a.delta+' '+key+' counters.');break;
  }
  case 'stats':{
   const c=requireCard(a.id,['battlefield']);
   if(a.values===null)delete c.battlefieldStats;
   else c.battlefieldStats={face:c.face||0,power:integer(a.values.power,-999999),toughness:integer(a.values.toughness,-999999)};
   break;
  }
  case 'entryValues':{const c=requireCard(a.id,['battlefield']);applyEntryChoices(c,a.values);note(g,c.name+': starting values set.');break;}
  case 'entryLife':requireCard(a.id,['battlefield']);chooseEntryLife(g,a.id,a.pay);break;
  case 'entryTapped':requireCard(a.id,['battlefield']);chooseEntryTapped(g,a.id,a.tapped);break;
  case 'oracleChoice':resolveOracleChoice(g,a.keys);settlePriority(g);break;
  case 'destructionChoice':resolveDestructionChoice(g,a.id);settlePriority(g);break;
  case 'proliferate':resolveProliferate(g,a.ids||[],a.owners||[]);break;
  case 'triggerTarget':chooseTriggerTarget(g,a.id,a.keys);break;
  case 'manualResolved':
   if(player.librarySearch)throw Error('Finish the library search before confirming the effect.');
   if(g.pendingEffect?.kind!=='combat-manual')throw Error('No manual effect for your seat.');
   note(g,g.pendingEffect.name+': manually resolved '+g.pendingEffect.text);delete g.pendingEffect;break;
  case 'attacker':requireCard(a.id,['battlefield']);setAttacker(g,a.id,a.target,a.selected,{exert:a.exert});break;
  case 'attackAll':
   for(const c of g.players[g.active].zones.battlefield){
    const target=attackTargets(g).find(t=>(!a.target||t.key===a.target)&&!attackTargetError(g,c,t))||attackTargets(g).find(t=>!attackTargetError(g,c,t));
    if(target&&!attackError(g,g.active,c)&&!g.combat?.attackers.some(v=>v.id===c.instance))setAttacker(g,c.instance,target.key,true);
   }break;
  case 'confirmAttackers':confirmAttackers(g);break;
  case 'blocker':requireCard(a.id,['battlefield']);setBlocker(g,controlledBlockerSeat(g,actor,a.id),a.id,a.attacker,a.selected);break;
  case 'blockerReplace':
   requireCard(a.id,['battlefield']);
   if(a.previous)setBlocker(g,controlledBlockerSeat(g,actor,a.id),a.id,a.previous,false);
   if(a.attacker)setBlocker(g,controlledBlockerSeat(g,actor,a.id),a.id,a.attacker,true);
   break;
  case 'confirmBlockers':{const defender=a.defender??actor;if(blockController(g,defender)!==actor)throw Error('Another player chooses these blockers.');confirmBlockers(g,defender);break;}
  case 'damage':applyCombatDamage(g);break;
  case 'damageAssignment':requireCard(a.id,['battlefield']);setDamageAssignment(g,actor,a.id,a.assignments);break;
  case 'deathChoice':{
   const c=requireCard(a.id,['battlefield']);
   if(!g.combat||!deathDestinations(g,findCard(g,a.id).owner,c).some(o=>o.zone===a.zone))throw Error('Invalid death destination.');
   g.combat.deathChoices[a.id]=a.zone;break;
  }
  case 'manaAdd':addMana(player,a.counts,{source:'Manual',snow:!!a.snow,...(a.restriction?{restriction:a.restriction}:{}),...(a.retain?{retain:a.retain}:{})});break;
  case 'manaRemove':{
   const lot=a.index!==undefined?player.mana[integer(a.index,0,999)]:player.mana.find(l=>l.type===a.color);
   if(lot){lot.amount--;player.mana=player.mana.filter(l=>l.amount>0);}break;
  }
  case 'landSettings':player.landsPlayed=integer(a.used);player.extraLandPlays=integer(a.extra);break;
  case 'manaSettings':validateManaSettings(a.settings);requireCard(a.id,['battlefield']).manaSettings=a.settings;break;
  case 'loyaltySettings':{
   const c=requireCard(a.id,['battlefield']);
   c.loyaltyExtra={turn:g.turn+':'+g.active,amount:integer(a.extra??0)};c.classLevel=integer(a.level??1,1,100);
   if(a.attachment){
    if(findCard(g,a.attachment)?.zone!=='battlefield')throw Error('Invalid attachment.');
    c.loyaltyAttachment=a.attachment;
   }else delete c.loyaltyAttachment;
   break;
  }
  case 'life':player.life=integer(player.life+integer(a.delta,-999999),-999999);note(g,player.name+' life: '+player.life);break;
  case 'playerStats':{
   player.name=text(a.name,80).trim()||player.name;player.life=integer(a.life,-999999);player.poison=integer(a.poison);
   if(!Array.isArray(a.damage)||a.damage.length!==g.players.length)throw Error('Invalid commander damage.');
   player.damage=a.damage.map(n=>integer(n));
   const commanders=commandersFor(g,owner);
   for(const c of commanders)c.commandCasts=integer(a.casts?.[c.instance]??c.commandCasts??0);
   player.casts=commanders.length?commanders.reduce((n,c)=>n+c.commandCasts,0):integer(a.totalCasts??player.casts);
   note(g,player.name+' stats updated.');break;
  }
  case 'libraryTop':{
   requireCard(a.id);const found=findCard(g,a.id),card=placeInLibrary(g,a.id,a.owner??found.owner);
   note(g,card.name+' placed on top of library.');break;
  }
  case 'removeToken':{
   const card=requireCard(a.id);
   if(!card.token)throw Error('Only tokens can be removed.');
   const f=findCard(g,a.id);
   if(f.zone==='stack')g.stack=g.stack.filter(e=>e.card?.instance!==a.id);
   else g.players[f.owner].zones[f.zone]=g.players[f.owner].zones[f.zone].filter(c=>c.instance!==a.id);
   note(g,'Removed token '+card.name);break;
  }
  case 'token':
   if(a.templateIndex!==undefined){const template=player.tokenCatalog?.[integer(a.templateIndex,0,249)];if(!template)throw Error('Choose a token from your imported reserve.');createTokens(g,owner,template,integer(a.count,1,50));break;}
   createTokens(g,owner,{name:text(a.name,100),type_line:'Token Creature',oracle_text:text(a.text||''),power:text(a.power||'0',20),toughness:text(a.toughness||'0',20)},integer(a.count,1,50));break;
  case 'import':{
   if(!Array.isArray(a.library)||!Array.isArray(a.command)||a.library.length+a.command.length>500||a.command.length>2)throw Error('Invalid imported deck.');
   const staged=newGame(g.players.length);
   staged.players[owner].tokenCatalog=structuredClone(a.tokenCatalog||[]);staged.players[owner].zones.library=a.library;staged.players[owner].zones.command=a.command;validateSession(staged);
   player.tokenCatalog=staged.players[owner].tokenCatalog.map(tokenTemplate);
   player.zones=Object.fromEntries(ZONES.map(z=>[z,[]]));
   player.zones.library=a.library.map(c=>({...c,ownerSeat:owner}));
   player.zones.command=a.command.map(c=>({...c,ownerSeat:owner,commander:true}));
   player.mana=[];player.casts=0;player.landsPlayed=0;player.extraLandPlays=0;
   if(a.name)player.name=text(a.name,80);
   g.stack=g.stack.filter(e=>e.owner!==owner);delete g.priority;
   shuffle(player.zones.library);draw(g,owner,Math.min(7,player.zones.library.length),{opening:true});
   note(g,'Imported '+(a.library.length+a.command.length)+' cards for '+player.name);
   if(!g.lobby&&!g.opening&&g.turn===1&&g.active===0&&g.step<=3&&!g.stack.length&&g.players.every(p=>!p.zones.battlefield.length)&&decksReadyForOpening(g)){const fresh=resetGame(g);beginOpeningHands(fresh);validateSession(fresh);return {game:fresh,description};}break;
  }
  case 'responseMode':if(!validResponseMode(a.mode))throw Error('Invalid response mode.');player.responseMode=a.mode;break;
  case 'reset':{if(a.opening===true&&!decksReadyForOpening(g))throw Error('Import a deck for every active seat before dealing starting hands.');const fresh=resetGame(g);if(fresh.lobby?.status==='playing'||g.opening||a.opening===true)beginOpeningHands(fresh);return {game:fresh,description:'Game reset; decks kept.'};}
  default:throw Error('Unknown gameplay action.');
 }
 // ---- Settle the accepted action, then validate the resulting snapshot ----
 // Costs/effects finish before deaths, priority and empty-step progression.
 // Resolution choices keep their continuation and suppress premature progression.
 stateBasedActions(g);settlePriority(g);
 if(g.lobby?.status==='waiting'&&a.type==='import')refreshLobbyDeck(g,owner);
 if(g.lobby?.status!=='waiting')autoPassEmptySteps(g,{automatic});
 validateSession(g);
 return {game:g,description};
}
