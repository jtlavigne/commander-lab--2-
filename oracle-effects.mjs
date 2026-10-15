import {finishResolutionTriggers} from './trigger-rules.mjs';
import {createCounterPlan,advanceCounterPlan,commitCounterPlan,validateCounterPlan,permanentCounterEvent,playerCounterEvent,proliferateCount} from './counter-effects.mjs';
import {compileReanimationEffect,runReanimationStep,reanimationChoiceOptions,resolveReanimationChoice,REANIMATION_OPERATIONS} from './reanimation.mjs';
import {compileSecretChoiceEffect,runSecretStep,resolveSecretNumber,SECRET_OPERATIONS} from './secret-choices.mjs';
import {gainLife} from './resource-rules.mjs';
import {soulbondOptions,pairCreatures} from './soulbond.mjs';
import {spellCopyCount} from './spell-copy-rules.mjs';
import {compilePermissionEffect,runPermissionStep,permissionChoiceOptions,resolvePermissionChoice,PERMISSION_OPERATIONS,offeredCardAllowed} from './permission-effects.mjs';
import {manifestTop} from './face-down.mjs';
import {cardFace,manaValue} from './card-state.mjs';
import {compileTemporalEffect,runTemporalStep,TEMPORAL_OPERATIONS} from './temporal-effects.mjs';
import {compileLibraryEffect,runLibraryStep,libraryChoiceOptions,resolveLibraryChoice,LIBRARY_OPERATIONS,LIBRARY_CHOICES} from './library-effects.mjs';
import {findCard,transfer,draw,shuffle,note} from './engine.mjs';
import {combatRecipient,combatStats,fieldCards,isCreature,selfSubject,keywordSet} from './creature-rules.mjs';
import {normalizeRules} from './ability-effects.mjs';
import {stateBasedActions,removePermanents as destroyBatch,dealDamagePackets} from './combat.mjs';
import {queueCombatTriggers,snapshotCard,queueReflexiveTrigger} from './combat-effects.mjs';
import {paymentPlan,payMana,addMana,parseProduction} from './mana.mjs';
import {addCombatPhase} from './turn-plan.mjs';
import {createTokens,tokenDefenders,enterAttacking,enterBlocking,tokenCopyDefinition} from './tokens.mjs';
import {counterSpell,copySpell,copyStackEntry} from './stack-effects.mjs';
import {finishSpell} from './spell-lifecycle.mjs';
import {refreshLinkedCards} from './linked-cards.mjs';
import {animateVehicle} from './vehicles.mjs';
import {destructionChoiceOptions} from './destruction.mjs';
import {grantKeywords,loseKeywords} from './temporary-effects.mjs';
import {winGame} from './game-outcome.mjs';
function removePermanents(g,ids,options){const result=destroyBatch(g,ids,options);if(g.pendingEffect?.kind==='destruction-choice')throw {destructionPause:true};return result;}
export function resolveDestructionChoice(g,id){const pending=g.pendingEffect;if(pending?.kind!=='destruction-choice')throw Error('No destruction replacement is pending.');const source=findCard(g,pending.id),aura=destructionChoiceOptions(g).find(c=>c.instance===id);if(source?.zone!=='battlefield'||!aura)throw Error('Choose an attached armor Aura.');source.card.armorChoice={id,battlefieldId:aura.battlefieldId||null};delete g.pendingEffect;if(pending.continuation)runProgram(g,pending.continuation.context,pending.continuation.program);else if(pending.resume.kind==='sba')stateBasedActions(g,{damageEvents:pending.resume.damageEvents});else destroyBatch(g,pending.resume.ids);finishResolutionTriggers(g);}
import {effectTargetSpec,effectTargetOptions} from './effect-targets.mjs';
import {announceEffectTargets,retargetCopy} from './spell-effects.mjs';
import {recordPlay} from './play-events.mjs';
import {attachPermanent} from './attachments.mjs';

const numbers={a:1,an:1,one:1,two:2,three:3,four:4,five:5};
const number=s=>numbers[s?.toLowerCase()]??Number(s);
export function effectAmount(g,context,expression){
 if(/^X$/i.test(expression))return context.x||context.event?.x||0;
 if(expression==="that spell's mana value")return manaValue(context.event?.card||{},{x:context.event?.x||0,onStack:true});
 if(expression==='that many')return context.event?.amount||0;
 if(expression==='source power'||expression.startsWith('source counter:')){
  const found=findCard(g,context.source.instance),live=found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(context.source.battlefieldId||null),last=found?.card.lastBattlefield?.id===context.source.battlefieldId?found.card.lastBattlefield:null;
  return expression==='source power'?Math.max(0,live?combatStats(g,found.owner,found.card)?.power||0:last?.power??context.source.lastKnownPower??0):(live?found.card.counters:last?.counters??context.source.counters)?.[expression.slice('source counter:'.length)]||0;
 }
 const n=number(expression);if(Number.isSafeInteger(n))return n;
 const owner=context.owner,cards=g.players[owner].zones.battlefield;
 const power=expression.match(/^(?:cards equal to )?the greatest power among (non-Human )?creatures you control$/i);
 if(power)return Math.max(0,...cards.filter(c=>isCreature(c)&&(!power[1]||!/\bHuman\b/.test(cardFace(c).type_line||''))).map(c=>Number(combatStats(g,owner,c)?.power)||0));
 if(/^the number of creatures you control$/i.test(expression))return cards.filter(isCreature).length;
 if(/^the number of creature tokens you control$/i.test(expression))return cards.filter(c=>c.token&&isCreature(c)).length;
 const subtype=expression.match(/^the number of (\w+) you control$/i);if(subtype)return cards.filter(c=>!c.faceDown&&new RegExp('\\b'+subtype[1].replace(/s$/i,'')+'\\b','i').test(cardFace(c).type_line||'')).length;
 if(/^a card for each green creature you control$/i.test(expression))return cards.filter(c=>isCreature(c)&&(cardFace(c).colors||[]).includes('G')).length;
 if(/^its power$/i.test(expression)){const found=findCard(g,context.event?.card?.instance);return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(context.event.card.battlefieldId||null)?Math.max(0,combatStats(g,found.owner,found.card)?.power||0):0;}
 if(/^the number of attacking creatures$/i.test(expression))return cards.filter(c=>isCreature(c)&&g.combat?.attackers.some(a=>a.id===c.instance)).length;
 if(/^the number of other attacking creatures$/i.test(expression))return cards.filter(c=>c.instance!==context.source.instance&&isCreature(c)&&g.combat?.attackers.some(a=>a.id===c.instance)).length;
 if(expression==='Equipment attached to source'){const found=findCard(g,context.source.instance);return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(context.source.battlefieldId||null)?g.players.flatMap(p=>p.zones.battlefield).filter(c=>!c.faceDown&&/\bEquipment\b/.test(cardFace(c).type_line||'')&&c.attachedTo===found.card.instance).length:0;}
 return null;
}
// Each handler matches a complete instruction. Unsupported text stays explicit.
// ---- Compile supported Oracle instructions ----
// A compound effect is accepted only when every instruction has a handler.
// Unknown suffixes keep the effect manual instead of silently disappearing.
export function compileOracleEffect(raw){
 const text=normalizeRules(raw).replace(/[ \t]*\([^()]*\)[ \t]*/g,' ').trim().replace(/^Until end of turn, (.+?)\.(?: \([^]*\))?$/i,'$1 until end of turn.').replace(/\s+\([^()]*\)\s*$/,'').replace(/(creature tokens?) with (lifelink|vigilance|forestwalk|haste|flying|deathtouch) (that are|that's|that is) (tapped and attacking|attacking|blocking that creature)/i,'$1 $3 $4 with $2');let m;
 const library=compileLibraryEffect(text);if(library)return library;
 const temporal=compileTemporalEffect(text);if(temporal)return temporal;
 const permission=compilePermissionEffect(text);if(permission)return permission;
 if(/^Destroy target creature or enchantment an opponent controls\. You lose life equal to that permanent's mana value\.$/i.test(text))return [{op:'destroyAndLoseLife'}];
 const reanimation=compileReanimationEffect(text);if(reanimation)return reanimation;
 if((m=text.match(/^Search your library for a card, put that card into your (hand|graveyard), then shuffle\.$/i)))return [{op:'search',scope:'card',min:1,max:1,to:m[1].toLowerCase()}];
 if(/^Search your library for up to three creature cards, put them into your graveyard, then shuffle\.$/i.test(text))return [{op:'search',scope:'creature',min:0,max:3,to:'graveyard'}];
 if((m=text.match(/^Add ([^.]+)\.\nThreshold — Add ([^.]+) instead if there are (seven|\d+) or more cards in your graveyard\.$/i))){const base=parseProduction('Add '+m[1]+'.'),threshold=parseProduction('Add '+m[2]+'.');if(base?.fixed&&threshold?.fixed)return [{op:'graveCount',minimum:m[3].toLowerCase()==='seven'?7:Number(m[3]),then:[{op:'mana',counts:threshold.fixed}],otherwise:[{op:'mana',counts:base.fixed}]}];}
 const secret=compileSecretChoiceEffect(text);if(secret)return secret;
 if((m=text.match(/^Target player draws (\w+|\d+) cards, then discards (\w+|\d+) cards\.$/i)))return [{op:'targetLoot',draw:number(m[1]),discard:number(m[2])}];
 if(/^Target player creates a Treasure token\.$/i.test(text))return [{op:'targetTreasure'}];
 if(/^[^.]+ deals \d+ damage divided as you choose among one or two targets\.$/i.test(text))return [{op:'dividedDamage',tapCreatures:false,restrictNoncreature:false}];
 if(text==='You may pair this creature with another creature.')return [{op:'soulbond',min:0,max:1}];
 if((m=text.match(/^you get (a|an|one|two|three|\d+) (\w+) counters?\.$/i)))return [{op:'playerCounter',amount:m[1].toLowerCase(),counter:m[2].toLowerCase()}];
 if((m=text.match(/^You may draw up to (\d+) cards\.$/i)))return [{op:'drawCount',amount:Number(m[1]),min:1,max:1}];
 if(/^Creatures your opponents control block this turn if able, and you choose how those creatures block\.$/i.test(text))return [{op:'controlBlocks'}];
 if(/^Proliferate(?: twice)?\.$/i.test(text))return Array.from({length:/twice/i.test(text)?2:1},()=>({op:'proliferate'}));
 if(/^Double the number of each kind of counter on any number of target permanents\.$/i.test(text))return [{op:'doubleCounters'}];
 if(text==='Create myriad copies.')return [{op:'myriad'}];
 if(text==='Exile the tokens created by this ability.')return [{op:'exileTrackedTokens'}];
 if((m=text.match(/^you may sacrifice another creature\. When you do, choose (one|two|three) —\n([^]+)$/i))){const modes=m[2].split('\n').map(line=>line.replace(/^• /,''));if(modes.every(mode=>compileOracleEffect(mode)))return [{op:'sacrificeReflexive',modes,count:number(m[1]),zone:'battlefield',min:0,max:1}];}
 if((m=text.match(/^[^.]+ deals damage equal to (the number of creature tokens you control) to target opponent\.$/i)))return [{op:'damage',scope:'target opponent',amount:'X',expression:m[1]}];
 if(/^exile the top card of each player's library, then you may cast any number of spells from among those cards without paying their mana costs\.$/i.test(text))return [{op:'exileToCast'}];
 if(/^that attacking player draws a card and you put two \+1\/\+1 counters on a creature you control\.$/i.test(text))return [{op:'attackingDraw',amount:1},{op:'chooseCounters',counter:'+1/+1',amount:'two',zone:'battlefield',min:1,max:1}];
 if(/^you and the attacking player each draw a card and lose 1 life\.$/i.test(text))return [{op:'attackingDraw',amount:1,self:true,life:-1}];
 if(/^Tap target creature that player controls and goad it\.$/i.test(text))return [{op:'tapTarget'},{op:'goadTarget'}];
 if((m=text.match(/^Then if you control (one|two|three|four|\d+) or more (\w+), transform this creature\.$/i)))return [{op:'transformSelf',count:number(m[1]),subtype:m[2].replace(/s$/i,'')}];
 if(/^Copy target instant or sorcery spell you control\. If this spell was cast from a graveyard, copy that spell twice instead\. You may choose new targets for the copies\.$/i.test(text))return [{op:'copySpell',twiceFromGraveyard:true}];
 if(/^Copy target instant or sorcery spell with mana value 4 or less\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copySpell'}];
 if(/^Copy this spell for each spell cast before it this turn\.$/i.test(text))return [{op:'copyEventSpells',count:'allBefore'}];
 if(/^Copy it for each other instant (?:or|and) sorcery spell you've cast before it this turn\. You may choose new targets for the copies\.$/i.test(text))return [{op:'copyEventSpells',count:'ownBefore'}];
 if(/^Copy target instant or sorcery spell\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copySpell'}];
 if(/^Copy target instant or sorcery spell you control\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copySpell'}];
 if(/^Copy target instant or sorcery spell, except that the copy is red\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copySpell',colors:['R']}];
 if(/^Copy that spell\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copyEventSpells',count:'one'}];
 if(/^Copy target instant or sorcery spell, then return it to its owner's hand\. You may choose new targets for the copy\.$/i.test(text))return [{op:'copySpell'},{op:'returnStackTarget'}];
 if(/^Counter target (?:noncreature )?spell\.$/i.test(text))return [{op:'counterSpell'}];
 if(/^Return (target (?:nonland )?(?:permanent|creature)(?: you don't control)?|each nonland permanent you don't control) to (?:its|their) owner's hand\.$/i.test(text))return [{op:'bounce',all:/^Return each/i.test(text)}];
 if(/^Return all attacking creatures to their (?:owners' hands|owner's hand)\.$/i.test(text))return [{op:'bounceAttackers'}];
 if(/^Tap all creatures your opponents control\.$/i.test(text))return [{op:'tapOpponents'}];
 if(/^If this spell was kicked, draw a card\.$/i.test(text))return [{op:'kickedDraw'}];
 if(/^Target player draws X cards\.$/i.test(text))return [{op:'targetDraw',amount:'X'}];
 if(/^Destroy each artifact you don't control\.$/i.test(text))return [{op:'destroyOpposing',type:'Artifact'}];
 if(/^[^.]+ deals X damage to any target\. Target player draws X cards\.$/i.test(text))return [{op:'damage',scope:'any target',amount:'X',group:0},{op:'targetDraw',amount:'X',group:1}];
 if(/^Choose any target, then choose another target for each time this spell was kicked\. [^.]+ deals X damage to each of them\.$/i.test(text))return [{op:'damage',scope:'any target',amount:'X'}];
 if(/^[^.]+ deals five times X damage to each of up to X targets\.$/i.test(text))return [{op:'damage',scope:'any target',amount:'X',multiplier:5}];
 if(/^Add \{R\} for each card in target opponent's hand\.$/i.test(text))return [{op:'scaledMana',color:'R',count:'targetHand'}];
 if(/^Add \{R\} for each tapped land your opponents control\.$/i.test(text))return [{op:'scaledMana',color:'R',count:'tappedOpponentLands'}];
 if(/^Each instant and sorcery card in your graveyard gains flashback until end of turn\. The flashback cost is equal to its mana cost\.$/i.test(text))return [{op:'grantFlashback'}];
 if(/^target instant or sorcery card in your graveyard gains flashback until end of turn\. The flashback cost is equal to its mana cost\.$/i.test(text))return [{op:'grantFlashback',target:true}];
 if(/^Shuffle [^.]+ into its owner's library\.$/i.test(text))return [{op:'shuffleSelf'}];
 if((m=text.match(/^Counter target (?:noncreature )?spell unless its controller pays (\{\d+\})\.$/i)))return [{op:'counterUnless',cost:m[1]}];
 if(/^Counter target enchantment, instant, or sorcery spell\. Its controller creates a 2\/2 blue Bird creature token with flying\.$/i.test(text))return [{op:'counterSpell'},{op:'counterControllerToken'}];
 if((m=text.match(/^Untap up to (two|three|four|\d+) lands\.$/i)))return [{op:'chooseUntapLands',max:number(m[1]),min:0}];
 if(/^you may draw a card\. If you do, discard a card\.$/i.test(text))return [{op:'optional',label:'Draw and discard a card',then:[{op:'draw',amount:'a'},{op:'discard',max:1}]}];
 if(/^Untap another target creature or land you control\.$/i.test(text))return [{op:'untapTargets'}];
 if(/^Put up to four target cards from your graveyard on the bottom of your library in any order\.$/i.test(text))return [{op:'bottomTargets'}];
 if(/^you may attach this Equipment to it\.$/i.test(text))return [{op:'optional',label:'Attach this Equipment to the entering creature',then:[{op:'attachSelfToEvent'}]}];
 if(/^Each creature deals 1 damage to its controller\.$/i.test(text))return [{op:'creatureControllerDamage',amount:1}];
 if(/^Destroy target creature\. It can't be regenerated\.$/i.test(text))return [{op:'destroy'}];
 if(/^Target creature you control deals damage equal to its power to target creature you don't control\.$/i.test(text))return [{op:'creatureDamage'}];
 if(/^Target creature you control deals damage equal to its power to target creature you don't control\. If the creature you control has trample, excess damage is dealt to that creature's controller instead\.$/i.test(text))return [{op:'creatureDamage',excess:true}];
 if(/^Choose target creature you control and target creature you don't control\. If you cast this spell during your main phase, the creature you control gets \+1\/\+1 until end of turn\. Then those creatures fight each other\.$/i.test(text))return [{op:'creatureDamage',fight:true,mainBuff:true}];
 if((m=text.match(/^(create an? )X\/X ([^]+? creature token[^]*?)(?:, where X is (that spell's mana value))?\.$/i))){const tokens=compileOracleEffect(m[1]+'1/1 '+m[2]+'.');if(tokens)return tokens.map(s=>({...s,statExpression:m[3]||'X'}));}
 if((m=text.match(/^put (a|one|two|three|\d+) ([+-]\d+\/[+-]\d+) counters? on (target creature(?: you control)?|each creature target player controls)\.(?: It gains (hexproof|deathtouch) until end of turn\.)?$/i)))return [{op:'counter',amount:m[1],counter:m[2],scope:m[3],keyword:m[4]}];
 if((m=text.match(/^put (a|one|two|three|\d+) ([+-]\d+\/[+-]\d+) counters? on (.+?), then (create .+)$/i))){const tokens=compileOracleEffect(m[4]);if(tokens)return [{op:'counter',amount:m[1],counter:m[2],scope:m[3]},...tokens];}
 if((m=text.match(/^(create a number of .+? creature tokens) equal to (.+?)'s power\.$/i))){const tokens=compileOracleEffect(m[1].replace(/a number of/i,'X')+'.');if(tokens)return tokens.map(s=>({...s,expression:'source power'}));}
 if((m=text.match(/^(create X .+?), where X is the number of ([+-]\d+\/[+-]\d+) counters on (.+?)\.$/i))){const tokens=compileOracleEffect(m[1]+'.');if(tokens)return tokens.map(s=>({...s,expression:'source counter:'+m[2]}));}
 if(/^[^.]+ deals (\d+) damage to the player or planeswalker it's attacking\.$/i.test(text))return [{op:'attackDamage',amount:Number(text.match(/deals (\d+)/i)[1])}];
 if((m=text.match(/^each opponent loses X life, where X is (the number of other attacking creatures)\.$/i)))return [{op:'life',scope:'each opponent',amount:-1,expression:m[1]}];
 if((m=text.match(/^Search your library for an? (Equipment|Aura|Aura or Equipment|instant or sorcery) card, reveal (?:it|that card), put (?:it|that card) into your hand, then shuffle\.$/i)))return [{op:'search',scope:m[1],max:1,to:'hand',reveal:true}];
 if((m=text.match(/^You may put an? (Equipment|Aura|artifact|enchantment|creature|land) card from your hand onto the battlefield\.$/i)))return [{op:'deploy',scope:m[1],max:1}];
 if(/^Sacrifice a land\.$/i.test(text))return [{op:'sacrificeChoice',scope:'land',zone:'battlefield',min:1,max:1}];
 if((m=text.match(/^(Create .+? creature token) for each Equipment attached to [^.]+\.$/i))){const program=compileOracleEffect(m[1]+'.');if(program)return program.map(step=>({...step,expression:'Equipment attached to source'}));}
 if(/^This Vehicle becomes an artifact creature until end of turn\.$/i.test(text))return [{op:'animateVehicle'}];
 if(/^you win the game\.$/i.test(text))return [{op:'win'}];
 if(/^Permanents your opponents control lose hexproof and indestructible until end of turn\.$/i.test(text))return [{op:'loseKeywords',scope:'permanents your opponents control',keywords:['hexproof','indestructible']}];
 if((m=text.match(/^each opponent can't block with more than (one|two|\d+) creatures? this combat\.$/i)))return [{op:'blockLimit',amount:({one:1,two:2}[m[1]]||Number(m[1]))}];
 if(/^Exile up to (?:one|two|three|\d+) target cards? from a single graveyard\.$/i.test(text))return [{op:'exileLinked'}];
 if(/^you may attach (?:it|that Equipment) to target creature you control\.$/i.test(text))return [{op:'optional',label:'Attach the entering Equipment',then:[{op:'attachEventEquipment'}]}];
 if(/^attach up to one target Equipment you control to that creature\.$/i.test(text))return [{op:'attachToEventCreature'}];
 if(/^return it to its owner's hand\.$/i.test(text))return [{op:'returnEventFromGraveyard'}];
 if(/^Return all instant and sorcery cards from your graveyard to your hand\.(?: Activate only if you control six or more artifacts\.)?$/i.test(text))return [{op:'returnSpells'}];
 if(/^whenever a player taps an Island for mana, that player adds an additional \{U\} until end of turn\.$/i.test(text))return [{op:'temporaryMana',scope:'Island',color:'U'}];
 if(/^Untap all lands you control\.$/i.test(text))return [{op:'untapLands'}];
 if(/^Destroy each nonland permanent with mana value X whose controller was dealt combat damage by this creature this turn\. Activate only once each turn\.$/i.test(text))return [{op:'destroyDamagedManaValue'}];
 if(/^you may exile target nontoken creature\.$/i.test(text))return [{op:'exileTarget',optional:true,imprint:true}];
 if(/^Untap this (?:artifact|creature|land|permanent)\.$/i.test(text))return [{op:'untapSelf'}];
 if(/^For each opponent, tap up to one target creature that player controls\.$/i.test(text))return [{op:'tapTarget'}];
 if(/^Tap target creature\.$/i.test(text))return [{op:'tapTarget'}];
 if(/^Search your library for a land card, reveal it, put it into your hand, then shuffle\.$/i.test(text))return [{op:'search',max:1,scope:'land',to:'hand',reveal:true}];
 if((m=text.match(/^Create (.+? creature token with \w+) and (a .+? creature token with \w+)\.$/i))){const first=compileOracleEffect('Create '+m[1]+'.'),second=compileOracleEffect('Create '+m[2]+'.');if(first&&second)return [...first,...second];}
 if(/^[^.]+ deals X damage divided as you choose among any number of targets\. Tap each creature dealt damage this way\. Players dealt damage this way can't cast noncreature spells this turn\.$/i.test(text))return [{op:'dividedDamage',tapCreatures:true,restrictNoncreature:true}];
 if(/^You may cast this card from exile without paying its mana cost\.$/i.test(text))return [{op:'reboundCast'}];
 if(/^Exile the top card of your library\. You may play that card this turn\.$/i.test(text))return [{op:'exileToPlay'}];
 if((m=text.match(/^Addendum — If you cast this spell during your main phase, put a ([+-]\d+\/[+-]\d+) counter on each of those creatures and they gain (\w+) until end of turn\.$/i)))return [{op:'addendum',counter:m[1],keyword:m[2].toLowerCase()}];
 if(/^draw a card unless that player pays \{X\}, where X is this creature's power\.$/i.test(text))return [{op:'unlessPay',amount:'source power',then:[{op:'draw',amount:'a'}]}];
 if(/^Remove target attacking creature you control from combat and untap it\.(?: \([^]*\))?$/i.test(text))return [{op:'removeCombat'}];
 if((m=text.match(/^you may return target permanent card with mana value (\d+) or less from your graveyard to the battlefield\.$/i)))return [{op:'return',zone:'battlefield',optional:true}];
 if((m=text.match(/^Choose up to one target creature you control\. Until end of turn, that creature gets ([+-]\d+)\/([+-]\d+), gains (\w+) if it's (white|blue|black|red|green), and gains (\w+) if it's (white|blue|black|red|green)\.$/i)))return [{op:'conditionalPump',power:Number(m[1]),toughness:Number(m[2]),grants:[{keyword:m[3].toLowerCase(),color:m[4].toLowerCase()},{keyword:m[5].toLowerCase(),color:m[6].toLowerCase()}]}];
 if((m=text.match(/^(For each opponent, )?create (a|an|one|two|three|four|\d+|X|that many) (\d+)\/(\d+) ((?:white|blue|black|red|green|colorless)(?: and (?:white|blue|black|red|green))?) ([a-z -]+?) creature tokens?(?:(?: that are| that's| that is) ((?:tapped and )?attacking|blocking that creature)( that player or a planeswalker they control)?)?(?: with ((?:deathtouch|lifelink|vigilance|flying|haste|forestwalk)(?: and (?:deathtouch|lifelink|vigilance|flying|haste|forestwalk))*))?(?:, where X is (the number of \w+ you control))?\.$/i))){
  const types=m[6].trim(),artifact=/\bartifact\b/i.test(types),subtype=types.replace(/\bartifact\b/i,'').trim();
  return [{op:'createTokens',amount:m[2],expression:m[10],perOpponent:!!m[1],attacking:/attacking/.test(m[7]||''),blocking:/blocking/.test(m[7]||''),tapped:/^tapped/.test(m[7]||''),fixedDefender:!!m[8],definition:{name:subtype,type_line:'Token '+(artifact?'Artifact ':'')+'Creature — '+subtype,power:m[3],toughness:m[4],colors:(m[5].toLowerCase().match(/white|blue|black|red|green/g)||[]).map(color=>({white:'W',blue:'U',black:'B',red:'R',green:'G'}[color])),oracle_text:m[9]||''}}];
 }
 if((m=text.match(/^Create (a|one|two|three|\d+) Treasure tokens?\.$/i)))return [{op:'createTokens',amount:m[1],definition:{name:'Treasure',type_line:'Token Artifact — Treasure',oracle_text:'{T}, Sacrifice this artifact: Add one mana of any color.'}}];
 if(/^you may search your library[^.\n]*\.$/i.test(text)){const search=compileOracleEffect(text.replace(/^you may /i,''));if(search)return [{op:'optional',label:'Search your library',then:search}];}
 if(text.startsWith('Choose one —\n')){const modes=text.slice('Choose one —\n'.length).split('\n').map(line=>line.replace(/^•\s*/,'')),programs=modes.map(compileOracleEffect);if(programs.every(Boolean))return [{op:'mode',modes:modes.map((label,i)=>({label,program:programs[i]}))}];}
 if((m=text.match(/^(Draw cards equal to the greatest power among creatures you control\.)\nYou may cast a spell with mana value (\d+) or less from your hand without paying its mana cost\.$/i)))return [...compileOracleEffect(m[1]),{op:'freeCast',max:1,manaValue:Number(m[2])}];
 if((m=text.match(/^(?:you )?draw (a|one|two|three|X|\d+) cards?\.$/i)))return [{op:'draw',amount:m[1]}];
 if((m=text.match(/^Scry (\d+)\.(?: \([^]*\))?$/i)))return [{op:'scry',amount:m[1]}];
 if((m=text.match(/^(each opponent|each player|target opponent|target player|that player|you) (?:gets?|gains?) (a|one|two|three|\d+) poison counters?\.$/i)))return [{op:'poison',scope:m[1].toLowerCase(),amount:m[2]}];
 if((m=text.match(/^(?:(you|each opponent|each player|target player|target opponent) )?(gain|gains|lose|loses) (\d+) life\.$/i)))return [{op:'life',scope:(m[1]||'you').toLowerCase(),amount:Number(m[3])*(/^los/i.test(m[2])?-1:1)}];
 if((m=text.match(/^you may play (an additional|two additional|\d+ additional) lands? this turn\.$/i)))return [{op:'landPlays',amount:/^an /i.test(m[1])?1:number(m[1].split(' ')[0])}];
 if(/^Add (?:\{[WUBRGC]\})+\.$/.test(text))return [{op:'mana',counts:parseProduction(text).fixed}];
 if((m=text.match(/^Untap (all creatures you control|each creature you control|all other creatures you control|all creatures that attacked this turn|all attacking creatures|target creature)\.$/i)))return [{op:'untapCreatures',scope:m[1].toLowerCase().replace(/^each creature/,'all creatures')}];
 if((m=text.match(/^Untap (all other creatures you control|all creatures you control) and after this phase, there is an additional combat phase\.$/i)))return [{op:'untapCreatures',scope:m[1].toLowerCase()},{op:'extraCombat',mainOnly:false,mainAfter:false}];
 if((m=text.match(/^After this (main )?phase, there is an additional combat phase( followed by an additional main phase)?\.$/i)))return [{op:'extraCombat',mainOnly:!!m[1],mainAfter:!!m[2]}];
 if(/^there's an additional combat phase after this phase\. At the beginning of that combat, untap all creatures you control\.$/i.test(text))return [{op:'extraCombat',mainOnly:true,mainAfter:false,delayedUntap:'all'}];
 if(/^After the second main phase this turn, there's an additional combat phase followed by an additional main phase\. At the beginning of that combat, untap all creatures that attacked this turn\.$/i.test(text))return [{op:'extraCombat',mainOnly:false,mainAfter:true,afterSecondMain:true,delayedUntap:'attacked'}];
 if(/^They gain first strike until end of turn\.$/i.test(text))return [{op:'lastKeywords',keywords:['first strike']}];
 if((m=text.match(/^(.+?) deals (\d+|X) damage to (target (?:creature with flying|player or planeswalker|creature or planeswalker|attacking or blocking creature|creature|planeswalker|player|opponent)|any target|each opponent|each player|each creature)\.$/i)))return [{op:'damage',amount:m[2],scope:m[3].toLowerCase()}];
 if(/^Exile target creature\. Its controller manifests the top card of their library\.$/i.test(text))return [{op:'manifestTarget'}];
 if(/^Exile target creature\. Its controller gains life equal to its power\.$/i.test(text))return [{op:'exileTarget',lifePower:true}];
 if(/^Exile target (?:nonland )?(?:creature|artifact|enchantment|permanent)\.$/i.test(text))return [{op:'exileTarget'}];
 if(/^Exile target creature\. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle\.$/i.test(text))return [{op:'exileTarget',search:true}];
 if((m=text.match(/^Destroy target (?:creature|permanent)\.(?: It can't be regenerated\.)? (?:Its controller|That creature's controller) creates a (\d+)\/(\d+) (white|blue|black|red|green|colorless) ([a-z ]+) creature token\.$/i)))return [{op:'gift',token:{power:m[1],toughness:m[2],colors:m[3]==='colorless'?[]:[{white:'W',blue:'U',black:'B',red:'R',green:'G'}[m[3]]],subtype:m[4]}}];
 if(/^The owner of target permanent shuffles it into their library, then reveals the top card of their library\. If it's a permanent card, they put it onto the battlefield\.$/i.test(text))return [{op:'warp'}];
 if((m=text.match(/^draw (cards equal to the greatest power among (?:non-Human )?creatures you control|a card for each green creature you control)\.$/i)))return [{op:'draw',amount:m[1]}];
 if((m=text.match(/^you may draw (a|one|two|three|\d+) cards?\.$/i)))return [{op:'optional',label:'Draw '+number(m[1])+' card(s)',then:[{op:'draw',amount:m[1]}]}];
 if((m=text.match(/^(?:you may )?search your library for (a |up to two )(basic land|Forest|land) cards?, (?:put (?:that card|it|them|those cards) onto the battlefield( tapped)?|reveal those cards, put one onto the battlefield tapped and the other into your hand), then shuffle\.$/i)))return [{op:'search',max:m[1].trim()==='a'?1:2,scope:m[2],tapped:!!m[3]||/one onto the battlefield tapped/.test(text),split:/other into your hand/.test(text)}];
 if(/^Search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle\.$/i.test(text))return [{op:'search',max:2,scope:'basic land',tapped:true,sharedType:true}];
 if(/^Search your library for a basic land card, reveal it, put it into your hand, then shuffle\.$/i.test(text))return [{op:'search',max:1,scope:'basic land',to:'hand',reveal:true}];
 if(/^put any number of creature cards from your hand onto the battlefield\.$/i.test(text))return [{op:'deploy',max:500}];
 if((m=text.match(/^return (?:a|an) (land|artifact|creature|enchantment|permanent) you control to its owner's hand\.$/i)))return [{op:'selectMove',zone:'battlefield',to:'hand',scope:m[1],originalOwner:true,min:1,max:1}];
 if((m=text.match(/^([^.]+?) (?:gets?|gains?) ([^]+?) until end of turn(?:, where X is (the number of creatures you control|the greatest power among creatures you control|the number of attacking creatures|its power))?\.$/i))){
  const stats=m[2].match(/([+-](?:\d+|X))\/([+-](?:\d+|X))/i),keywords=[...m[2].matchAll(/\b(protection from each color|first strike|double strike|trample|haste|vigilance|flying|indestructible|lifelink|hexproof|shroud|infect|deathtouch)\b/gi)].map(m=>m[1].toLowerCase().replace('protection from each color','protection from all colors'));
  // Restrict vocabulary so conditional effects are never partially applied.
  const residue=m[2].replace(/[+-](?:\d+|X)\/[+-](?:\d+|X)/gi,'').replace(/\b(?:protection from each color|first strike|double strike|trample|haste|vigilance|flying|indestructible|lifelink|hexproof|shroud|infect|deathtouch|and|gets?|gains?)\b/gi,'').replace(/[,\s]/g,'');
  if(!residue&&(stats||keywords.length))return [{op:'pump',scope:m[1],power:stats?.[1]||'0',toughness:stats?.[2]||'0',amount:m[3],keywords}];
 }
 // Named self-counter instructions retain their subject for incarnation checks.
 if((m=text.match(/^put (a|an|one|two|three|\d+) ([+-]\d+\/[+-]\d+|[a-z]+) counters? on (.+?)\.$/i))&&(/^[A-Z]/.test(m[3])||/^this (?:artifact|creature|permanent|planeswalker|land)$/i.test(m[3])))return [{op:'counter',amount:m[1],counter:m[2].toLowerCase(),scope:m[3],selfOnly:true}];
 if((m=text.match(/^put (a|one|two|three|\d+) ([+-]\d+\/[+-]\d+|[a-z]+) counters? on (it|each creature you control)\.(?: It gains (haste) until end of turn\.)?$/i)))return [{op:'counter',amount:m[1],counter:m[2],scope:m[3],keyword:m[4]}];
 if((m=text.match(/^create that many Treasure tokens\.$/i)))return [{op:'treasure',amount:'damage'}];
 if((m=text.match(/^(?:you may )?destroy (?:up to (?:one|two|three|\d+) )?target [^.]+\.$/i)))return [{op:'destroy',target:true,optional:/^you may/i.test(text)}];
 if((m=text.match(/^destroy all artifacts and enchantments\. Put a \+1\/\+1 counter on (.+?) for each permanent destroyed this way\.$/i)))return [{op:'sweep',types:['Artifact','Enchantment'],counterSelf:true}];
 if(/^it fights up to one target creature you don't control\.$/i.test(text))return [{op:'fight'}];
 if((m=text.match(/^(?:you may )?return target (?:artifact )?card from your graveyard to your hand\.$/i)))return [{op:'return',zone:'hand',optional:/^you may/i.test(text)}];
 if(/^exile (?:target player's|each opponent's|all) graveyards?\.(?: Draw a card\.)?$/i.test(text))return [{op:'exileGraves',scope:/target player's/i.test(text)?'target':/each opponent's/i.test(text)?'opponents':'all'},...(/Draw a card/.test(text)?[{op:'draw',amount:'a'}]:[])];
 if(/^exile target card from a graveyard\.$/i.test(text))return [{op:'return',zone:'exile'}];
 if(/^target creature can't be blocked this turn\.$/i.test(text))return [{op:'unblockable'}];
 if(/^attach to target (?:legendary )?creature you control\.(?: Activate only as a sorcery\.)?$/i.test(text))return [{op:'attach'}];
 if((m=text.match(/^you may destroy up to three target noncreature permanents\. For each permanent put into a graveyard this way, its controller creates a (\d+)\/(\d+) green (\w+) creature token\.$/i)))return [{op:'destroy',target:true,optional:true,token:{power:m[1],toughness:m[2],subtype:m[3],colors:['G']}}];
 if(/^draw cards equal to the sacrificed creature's power, then discard three cards\.$/i.test(text))return [{op:'draw',amount:'sacrificed power'},{op:'discard',max:3}];
 if(/^return target Human you control to its owner's hand\. (?:[^.]+) gains indestructible until end of turn\.$/i.test(text))return [{op:'return',zone:'hand'},{op:'pumpSelf',keywords:['indestructible']}];
 if(/^that land doesn't untap during its controller's next untap step\.$/i.test(text))return [{op:'skipUntap'}];
 if(/^it deals that much damage to target planeswalker that player controls\.$/i.test(text))return [{op:'repeatDamage'}];
 if(/^put X charge counters on this land\.$/i.test(text))return [{op:'chargeX'}];
 if(/^destroy each nonland permanent with mana value equal to the number of charge counters on this land\.$/i.test(text))return [{op:'destroyManaValue'}];
 if(/^destroy target nonbasic land an opponent controls\. Each player searches their library for a basic land card, puts it onto the battlefield, then shuffles\.$/i.test(text))return [{op:'destroyAndSearch',who:'each'}];
 if(/^destroy target land\. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle\.$/i.test(text))return [{op:'destroyAndSearch',who:'controller'}];
 if(/^target player exiles a card from their graveyard\.$/i.test(text))return [{op:'exileOne'}];
 if((m=text.match(/^you may pay (\{[WUBRGC0-9]+\})\. If you do, draw a card\.$/i)))return [{op:'optionalPay',cost:m[1],then:[{op:'draw',amount:'a'}]}];
 if((m=text.match(/^you may pay ((?:\{[WUBRGC0-9]+\})+)\. If you do, (.+)$/i))){const then=compileOracleEffect(m[2]);if(then)return [{op:'optionalPay',cost:m[1],then}];}
 // Compose only fully recognized instructions. Never execute a known prefix
 // while dropping an unknown suffix, condition, replacement, or cost.
 const paragraphs=text.split(/\n+/);if(paragraphs.length>1){const parts=paragraphs.map(compileOracleEffect);if(parts.every(Boolean)){const spec=effectTargetSpec(text);if(spec?.repeated&&spec.groups){let group=0;return parts.flatMap((part,i)=>{const targetGroup=effectTargetSpec(paragraphs[i])?group++:null;return part.map(step=>({...step,targetGroup}));});}return parts.flat();}}
 const instructions=text.replace(/^(Draw [^.]+? cards?) and (create [^]+)$/i,'$1. $2').replace(/^(you gain \d+ life) and (draw [^.]+ cards?)\.$/i,'$1. $2.').replace(/\b(draw [^.]+? cards?) and you (lose \d+ life\.)/gi,'$1. You $2').split(/\.\s+|\n+/).map(s=>s.trim()).filter(Boolean);
 if(instructions.length>1){const parts=instructions.map(s=>compileOracleEffect(s.endsWith('.')?s:s+'.'));if(parts.every(Boolean))return parts.flat();}
 return null;
}
// ---- Resolution context and instruction execution ----
// Context carries announced targets, source identity and cast choices. Pending
// effects save it with the remaining instructions so reload cannot repeat costs
// or restart an earlier draw/damage instruction.
function contextFor(entry){return {owner:entry.owner,name:entry.name||entry.card?.name,source:entry.source||entry.card,event:entry.combatTrigger?.event,target:entry.targets?.[0]||entry.combatTrigger?.target,targets:entry.targets||entry.combatTrigger?.targets||[entry.combatTrigger?.target].filter(Boolean),division:entry.division,sacrificedPower:entry.sacrificedPower,x:entry.castX||0,castStep:entry.castStep,castFrom:entry.castFrom,...(entry.resolving?{spellId:entry.card.instance}:{})};}
export function applyOracleEffect(g,entry,text=entry.text){
 const program=compileOracleEffect(text)||(!text.endsWith('.')?compileOracleEffect(text+'.'):null)||(entry.kind==='ability'?compileOracleEffect(text.replace(/\s+Activate only as a sorcery\.$/i,'')):null);if(!program)return false;runProgram(g,contextFor(entry),program);return true;
}
export function applyCounterEvents(g,entry,events){runProgram(g,contextFor(entry),[{op:'counterBatch',events}]);}
function runProgram(g,context,program){
 // Triggers created during resolution wait until the whole instruction sequence
 // and its choices finish. Players cannot respond between those instructions.
 g.resolutionInProgress=true;
 const playerRecipients=(scope,recipient=context.owner)=>scope==='that player'?[context.event?.target?.owner].filter(owner=>g.players[owner]):scope==='you'?[recipient]:scope.startsWith('target')?(context.targets||[]).filter(t=>t.kind==='player').map(t=>t.owner):g.players.flatMap((player,owner)=>player.eliminated||scope==='each opponent'&&owner===context.owner?[]:[owner]);
 for(let i=0;i<program.length;i++){
  if(g.result){delete g.resolutionInProgress;delete g.deferredTriggers;return;}
  const step=program[i],rest=program.slice(i+1),owner=step.owner??context.owner;if(g.players[owner]?.eliminated)continue;
  if(Object.hasOwn(step,'targetGroup')){context.announcedTargets??=context.targets;context.activeTargetGroup=step.targetGroup;}
  if(context.activeTargetGroup!==undefined){context.targets=context.activeTargetGroup===null?context.announcedTargets:context.announcedTargets.filter(t=>t.group===context.activeTargetGroup);context.target=context.targets[0];}
  try{
  if(step.op==='graveCount'){runProgram(g,context,[...(g.players[owner].zones.graveyard.length>=step.minimum?step.then:step.otherwise),...rest]);return;}
  if(step.op==='destroyAndLoseLife'){const found=findCard(g,context.target?.id);if(found?.zone==='battlefield'){const amount=manaValue(found.card);removePermanents(g,[found.card.instance]);g.players[owner].life-=amount;}}
  if(step.op==='targetLoot'){runProgram(g,context,[...(context.targets||[]).filter(t=>t.kind==='player').flatMap(t=>[{op:'draw',owner:t.owner,amount:String(step.draw)},{op:'discard',owner:t.owner,max:step.discard}]),...rest]);return;}
  if(step.op==='targetTreasure')for(const target of context.targets||[])if(target.kind==='player')createTokens(g,target.owner,{name:'Treasure',type_line:'Token Artifact — Treasure',oracle_text:'{T}, Sacrifice this artifact: Add one mana of any color.'},1);
  if(step.op==='myriad'){const defenders=g.players.flatMap((player,seat)=>player.eliminated||seat===owner||seat===context.event?.defender?[]:[seat]);if(defenders.length&&g.combat){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{...step,defenders,max:defenders.length},remaining:rest};return;}}
  if(step.op==='exileTrackedTokens')for(const token of context.event?.tokens||[]){const found=findCard(g,token.id);if(found?.zone==='battlefield'&&found.card.battlefieldId===token.battlefieldId){const controller=found.card.ownerSeat??found.owner;transfer(g,token.id,'exile',controller);g.players[controller].zones.exile=g.players[controller].zones.exile.filter(c=>c.instance!==token.id);}}
  if(step.op==='controlBlocks'){const turn=g.turn+':'+g.active;if(g.blockingRules?.turn!==turn)g.blockingRules={turn,controllers:g.players.map((_,seat)=>seat),must:g.players.map(()=>false)};for(let seat=0;seat<g.players.length;seat++)if(seat!==owner){g.blockingRules.controllers[seat]=owner;g.blockingRules.must[seat]=true;}}
  if(step.op==='proliferate'){const count=step.expanded?1:proliferateCount(g,owner);g.pendingEffect={kind:'proliferate',owner,name:context.name,context,remaining:[...Array.from({length:count-1},()=>({op:'proliferate',expanded:true})),...rest]};return;}
  if(step.op==='counterBatch'){const plan=createCounterPlan(g,step.events),choice=advanceCounterPlan(plan);if(choice){g.pendingEffect={kind:'counter-choice',owner:choice.owner,name:context.name,context,remaining:rest,plan};return;}commitCounterPlan(g,plan);}
  if(step.op==='soulbond'&&soulbondOptions(g,owner,context.source,context.event).length){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.op==='counterSpell'){const target=context.targets?.find(t=>t.zone==='stack')||context.target,result=target&&counterSpell(g,target,owner,context.source);if(result)context.counteredController=result.owner;}
  if(step.op==='bounce')for(const target of step.all?fieldCards(g).filter(f=>f.owner!==owner&&!/\bLand\b/.test(cardFace(f.card).type_line||'')).map(f=>({id:f.card.instance})):context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield')transfer(g,target.id,'hand',found.card.ownerSeat??found.owner);}
  if(step.op==='bounceAttackers')for(const id of (g.combat?.attackers||[]).map(a=>a.id)){const found=findCard(g,id);if(found?.zone==='battlefield')transfer(g,id,'hand',found.card.ownerSeat??found.owner);}
  if(step.op==='tapOpponents')for(const {card,owner:seat} of fieldCards(g))if(seat!==owner&&isCreature(card))card.tapped=true;
  if(step.op==='kickedDraw'&&context.source.castKicks){runProgram(g,context,[{op:'draw',owner,amount:'a'},...rest]);return;}
  if(step.op==='targetDraw'){runProgram(g,context,[...(context.targets||[]).filter(target=>target.kind==='player'&&(step.group===undefined||target.group===step.group)).map(target=>({op:'draw',owner:target.owner,amount:String(context.x||0)})),...rest]);return;}
  if(step.op==='scaledMana'){const amount=step.count==='targetHand'?g.players[context.target?.owner]?.zones.hand.length||0:fieldCards(g).filter(f=>f.owner!==owner&&f.card.tapped&&/\bLand\b/.test(cardFace(f.card).type_line||'')).length;addMana(g.players[owner],{[step.color]:amount},{source:context.name});}
  if(step.op==='grantFlashback')for(const card of g.players[owner].zones.graveyard)if(/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||'')&&(!step.target||(context.targets||[context.target]).some(t=>t?.id===card.instance)))card.flashbackGrant={owner,turn:g.turn+':'+g.active,zoneChangeId:card.zoneChangeId||null,cost:'printed'};
  if(step.op==='destroyOpposing')removePermanents(g,fieldCards(g).filter(f=>f.owner!==owner&&new RegExp('\\b'+step.type+'\\b').test(cardFace(f.card).type_line||'')).map(f=>f.card.instance));
  if(step.op==='shuffleSelf'){const found=findCard(g,context.spellId);if(found?.zone==='stack'){const seat=found.card.ownerSeat??found.owner;transfer(g,found.card.instance,'library',seat);shuffle(g.players[seat].zones.library);}}
  if(step.op==='counterUnless'){const target=g.stack.find(e=>e.card?.instance===context.target?.id&&e.card.zoneChangeId===context.target.zoneChangeId);if(target){runProgram(g,context,[{op:'optionalPay',owner:target.owner,cost:step.cost,then:[],otherwise:[{op:'counterSpell'}]},...rest]);return;}}
  if(step.op==='counterControllerToken'&&g.players[context.counteredController]&&!g.players[context.counteredController].eliminated)createTokens(g,context.counteredController,{name:'Bird',type_line:'Token Creature \u2014 Bird',power:'2',toughness:'2',colors:['U'],oracle_text:'Flying'},1);
  if(step.op==='chooseUntapLands'){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.op==='transformSelf'){const source=findCard(g,context.source.instance);if(source?.zone==='battlefield'&&source.card.battlefieldId===context.source.battlefieldId&&source.card.layout==='transform'&&source.card.card_faces?.length>1&&g.players[owner].zones.battlefield.filter(card=>isCreature(card)&&new RegExp('\\b'+step.subtype+'\\b','i').test(cardFace(card).type_line||'')).length>=step.count)source.card.face=(source.card.face||0)===0?1:0;}
  if(step.op==='copySpell'||step.op==='copyEventSpells'){
   const n=step.left??spellCopyCount(g,owner,step.op==='copySpell'?(step.amount??(step.twiceFromGraveyard&&context.castFrom==='graveyard'?2:1)):step.count==='one'?1:step.count==='allBefore'?context.event?.spellsBefore||0:context.event?.ownSpellsBefore||0);
   if(!n)continue;if(!Number.isSafeInteger(n)||n>500)throw Error('This copy count needs a supported whole-number value.');
   const original=context.event?.spell,live=original&&g.stack.find(e=>e.card?.instance===original.card.instance&&e.card.zoneChangeId===original.card.zoneChangeId);
   const entry=step.op==='copySpell'?(step.target||context.target)&&copySpell(g,step.target||context.target,owner,step):original&&copyStackEntry(g,live||original,owner,step),next=[...(n>1?[{...step,left:n-1}]:[]),...rest];
   if(entry&&step.trackOrder)(context.copyOrder??=[]).push({id:entry.card.instance,zoneChangeId:entry.card.zoneChangeId});
   if(entry?.targets?.length){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'retargetCopy',id:entry.card.instance,zoneChangeId:entry.card.zoneChangeId},remaining:next};return;}
   if(n>1){runProgram(g,context,next);return;}
  }
  if(step.op==='returnStackTarget'){const target=g.stack.find(e=>e.card?.instance===context.target?.id&&e.card.zoneChangeId===context.target.zoneChangeId);if(target)transfer(g,target.card.instance,'hand',target.card.ownerSeat??target.owner);}
  const libraryResult=runLibraryStep(g,context,step,rest,runProgram);if(libraryResult===2)return;if(libraryResult===1)continue;
  const reanimationResult=runReanimationStep(g,context,step,rest);if(reanimationResult===2)return;if(reanimationResult===1)continue;
  const secretResult=runSecretStep(g,context,step,rest,runProgram);if(secretResult===2)return;if(secretResult===1)continue;
  const permissionResult=runPermissionStep(g,context,step,rest,runProgram);if(permissionResult===2)return;if(permissionResult===1)continue;
  if(step.op==='chooseManaColor'){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  const temporalResult=runTemporalStep(g,context,step,rest,runProgram);if(temporalResult==='paused')return;if(temporalResult)continue;
  if(step.op==='drawCount'){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.op==='returnSpells')for(const card of [...g.players[owner].zones.graveyard])if(/\b(?:Instant|Sorcery)\b/.test(cardFace(card).type_line||''))transfer(g,card.instance,'hand',owner);
  if(step.op==='temporaryMana')(g.temporaryManaRules??=[]).push({owner,scope:step.scope,color:step.color,source:context.source});
  if(step.op==='manifestTarget'){const found=findCard(g,context.target?.id);if(found?.zone==='battlefield'){const controller=found.owner;transfer(g,found.card.instance,'exile',found.card.ownerSeat??controller);manifestTop(g,controller);}}
  if(step.op==='win')winGame(g,owner,context.name);
  if(step.op==='untapTargets')for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield'){found.card.tapped=false;delete found.card.manaActivation;delete found.card.tapAbility;}}
  if(step.op==='bottomTargets'){const ids=(context.targets||[]).filter(t=>findCard(g,t.id)?.zone==='graveyard').map(t=>t.id);if(ids.length){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'orderGraveBottom',ids,min:ids.length,max:ids.length},remaining:rest};return;}}
  if(step.op==='attachSelfToEvent'){const source=findCard(g,context.source.instance),recipient=findCard(g,context.event?.card.instance);if(source?.zone==='battlefield'&&source.card.battlefieldId===context.source.battlefieldId&&recipient?.zone==='battlefield'&&recipient.card.battlefieldId===context.event.card.battlefieldId)attachPermanent(g,source.card.instance,recipient.card.instance);}
  if(step.op==='creatureDamage'){
   const own=context.targets?.find(t=>t.group===0),other=context.targets?.find(t=>t.group===1),a=own&&findCard(g,own.id),b=other&&findCard(g,other.id);
   if(step.mainBuff&&a?.zone==='battlefield'&&[3,9].includes(context.castStep)){a.card.temporaryStats??={power:0,toughness:0};a.card.temporaryStats.power++;a.card.temporaryStats.toughness++;}
   if(a?.zone==='battlefield'&&b?.zone==='battlefield'){
    const amount=Math.max(0,combatStats(g,a.owner,a.card)?.power||0),keywords=keywordSet(g,a.owner,a.card),lethal=keywords.has('deathtouch')?1:Math.max(0,(combatStats(g,b.owner,b.card)?.toughness||0)-(b.card.markedDamage||0)),excess=step.excess&&keywords.has('trample')?Math.max(0,amount-lethal):0;
    const packets=[{source:a,target:other,amount:amount-excess}];if(excess)packets.push({source:a,target:{kind:'player',owner:b.owner},amount:excess});if(step.fight)packets.push({source:b,target:own,amount:Math.max(0,combatStats(g,b.owner,b.card)?.power||0)});queueCombatTriggers(g,dealDamagePackets(g,packets));
   }
  }
  if(step.op==='sacrificeReflexive'){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.op==='exileToCast'){const cards=[];for(let seat=0;seat<g.players.length;seat++){const card=g.players[seat].zones.library[0];if(card){transfer(g,card.instance,'exile',seat);cards.push({id:card.instance,zoneChangeId:card.zoneChangeId});}}runProgram(g,context,[{op:'chooseExiled',cards,min:0,max:1},...rest]);return;}
  if(step.op==='chooseExiled'){const available=step.cards.filter(ref=>{const found=findCard(g,ref.id);return found?.zone===(step.zone||'exile')&&(found.card.zoneChangeId||null)===ref.zoneChangeId&&offeredCardAllowed(found.card,step);});if(!available.length)continue;g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{...step,cards:available},remaining:rest};return;}
  if(step.op==='attackingDraw'){runProgram(g,context,[...[...new Set([context.event?.owner,...(step.self?[owner]:[])])].filter(s=>g.players[s]).flatMap(seat=>[{op:'draw',owner:seat,amount:String(step.amount)},...(step.life?[{op:'life',owner:seat,scope:'you',amount:step.life}]:[])]),...rest]);return;}
  if(step.op==='chooseCounters'){if(!g.players[owner].zones.battlefield.some(isCreature))continue;g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.op==='goadTarget')for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield'&&isCreature(found.card))found.card.goadedBy=[...new Set([...(found.card.goadedBy||[]),owner])];}
  if(step.op==='creatureControllerDamage'){const events=dealDamagePackets(g,fieldCards(g).filter(({card})=>isCreature(card)).map(source=>({source,target:{kind:'player',owner:source.owner},amount:step.amount})));stateBasedActions(g,{damageEvents:events});}
  if(step.op==='animateVehicle')animateVehicle(g,context.source);
  if(step.op==='loseKeywords')for(const {card,owner:controller} of fieldCards(g))if(combatRecipient(g,step.scope,card,controller,context.source,owner))loseKeywords(card,step.keywords);
  if(step.op==='blockLimit'&&g.combat){g.combat.blockLimits??={};for(let seat=0;seat<g.players.length;seat++)if(seat!==owner)g.combat.blockLimits[seat]=Math.min(g.combat.blockLimits[seat]??Infinity,step.amount);}
  if(step.op==='exileLinked'){
   const source=findCard(g,context.source.instance),live=source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null);
   for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone!=='graveyard'||(found.card.zoneChangeId||null)!==target.zoneChangeId)continue;transfer(g,target.id,'exile',found.card.ownerSeat??found.owner);if(live)(source.card.exileLinks??=[]).push({id:target.id,zoneChangeId:found.card.zoneChangeId});}refreshLinkedCards(g);
  }
  if(step.op==='attachEventEquipment'||step.op==='attachToEventCreature'){
   const event=findCard(g,context.event?.card?.instance),target=findCard(g,context.target?.id);
   if(event?.zone==='battlefield'&&(event.card.battlefieldId||null)===(context.event.card.battlefieldId||null)&&target?.zone==='battlefield')attachPermanent(g,step.op==='attachEventEquipment'?event.card.instance:target.card.instance,step.op==='attachEventEquipment'?target.card.instance:event.card.instance);
  }
  if(step.op==='returnEventFromGraveyard'){const found=findCard(g,context.event?.card?.instance);if(context.event?.kind==='graveyard'&&found?.zone==='graveyard'&&found.card.zoneChangeId===context.event.deadZoneId)transfer(g,found.card.instance,'hand',found.card.ownerSeat??found.owner);}
  if(step.op==='untapLands')for(const card of g.players[owner].zones.battlefield)if(!card.faceDown&&/\bLand\b/.test(cardFace(card).type_line||'')){card.tapped=false;delete card.manaActivation;delete card.tapAbility;}
  if(step.op==='destroyDamagedManaValue'){const found=findCard(g,context.source.instance),source=found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(context.source.battlefieldId||null)?found.card:context.source,history=source.combatDamageHistory;if(history?.turn===g.turn+':'+g.active)removePermanents(g,fieldCards(g).filter(({card,owner})=>history.players.includes(owner)&&!card.faceDown&&!/\bLand\b/.test(cardFace(card).type_line||'')&&(card.cmc||0)===context.x).map(({card})=>card.instance));}
  if(step.op==='untapSelf'){const found=findCard(g,context.source.instance);if(found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(context.source.battlefieldId||null)){found.card.tapped=false;delete found.card.manaActivation;delete found.card.tapAbility;}}
  if(step.op==='tapTarget')for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield')found.card.tapped=true;}
  if(step.op==='dividedDamage'){
   const packets=(context.targets||[]).map(target=>({source:{owner,card:context.source},target,amount:context.division?.find(d=>d.key===target.key)?.amount||0})),events=dealDamagePackets(g,packets);
   for(const event of events.filter(e=>e.kind==='damage'))if(event.target.kind==='player'&&step.restrictNoncreature)g.players[event.target.owner].noncreatureLock=g.turn+':'+g.active;else if(event.target.kind==='card'&&step.tapCreatures){const found=findCard(g,event.target.id);if(found?.zone==='battlefield'&&isCreature(found.card))found.card.tapped=true;}
   queueCombatTriggers(g,events);
  }
  if(step.op==='reboundCast'){const card=findCard(g,context.source.instance);if(card?.zone==='exile'&&card.card.zoneChangeId===context.event.zoneChangeId){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{op:'castExiled',id:card.card.instance,zoneChangeId:card.card.zoneChangeId,min:0,max:0},remaining:rest};return;}}
  if(step.op==='exileToPlay'){const card=g.players[owner].zones.library[0];if(card){transfer(g,card.instance,'exile',owner);card.playPermission={owner,turn:g.turn+':'+g.active,zoneChangeId:card.zoneChangeId};}}
  if(step.op==='unlessPay'){
   const source=findCard(g,context.source.instance),power=source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null)?combatStats(g,source.owner,source.card)?.power:context.source.lastKnownPower;
   const amount=Math.max(0,Number(power)||0);
   runProgram(g,context,[{op:'optionalPay',owner:context.event.owner,cost:step.cost||'{'+amount+'}',then:[],otherwise:step.then},...rest]);return;
  }
  if(step.op==='conditionalPump')for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield'){
   const c=found.card;c.temporaryStats??={power:0,toughness:0};c.temporaryStats.power+=step.power;c.temporaryStats.toughness+=step.toughness;
   const colors=cardFace(c).colors||[];grantKeywords(c,step.grants.filter(grant=>colors.includes({white:'W',blue:'U',black:'B',red:'R',green:'G'}[grant.color])).map(grant=>grant.keyword));
  }}
  if(step.op==='createTokens'){
   const count=effectAmount(g,context,step.expression||step.amount),groups=step.perOpponent?g.players.flatMap((player,seat)=>player.eliminated||seat===owner?[]:[seat]):[undefined],tokens=[];
   if(!Number.isSafeInteger(count)||count<0||count*groups.length>500)throw Error('This token amount needs a supported whole-number value.');
   const definition=step.statExpression?{...step.definition,power:String(effectAmount(g,context,step.statExpression)),toughness:String(effectAmount(g,context,step.statExpression))}:step.definition;
   const created=createTokens(g,owner,definition,count*groups.length,{tapped:!!step.tapped});
   for(const [index,card] of created.entries()){const defender=groups[Math.floor(index/count)];if(step.blocking)enterBlocking(g,owner,card.instance,context.event?.attacker);else if(step.attacking&&tokenDefenders(g,owner,step.fixedDefender?defender:undefined).length)tokens.push({id:card.instance,...(step.fixedDefender?{defender}:{})});}
   if(tokens.length){runProgram(g,context,[{op:'tokenDefenders',tokens,min:1,max:1},...rest]);return;}
  }
  if(step.op==='tokenDefenders'){
   if(!step.tokens.length)continue;
   if(!tokenDefenders(g,owner,step.tokens[0].defender).length){runProgram(g,context,[{...step,tokens:step.tokens.slice(1)},...rest]);return;}
   g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;
  }
  if(step.op==='scry'){const ids=g.players[owner].zones.library.slice(0,Number(step.amount)).map(c=>c.instance);if(!ids.length)continue;g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step:{...step,ids,min:0,max:ids.length},remaining:rest};return;}
  if(['search','deploy','optional','optionalPay','mode','freeCast','discard','selectMove','sacrificeChoice','orderTop'].includes(step.op)){g.pendingEffect={kind:'oracle-choice',owner,name:context.name,context,step,remaining:rest};return;}
  if(step.optional){runProgram(g,context,[{op:'optional',label:'Apply this effect?',then:[{...step,optional:false}]},...rest]);return;}
  if(step.op==='draw'||step.op==='resumeDraw'){const n=step.op==='resumeDraw'?0:step.amount==='sacrificed power'?Math.max(0,context.sacrificedPower||0):effectAmount(g,context,step.amount);if(n===null)throw Error('This draw amount needs a manual value.');draw(g,owner,n,{turnAction:false,work:step.work});if(g.pendingEffect?.step.op==='miracleReveal'){g.pendingEffect.context=context;g.pendingEffect.remaining.push(...rest);return;}}
  if(step.op==='poison'||step.op==='playerCounter'){const seats=step.op==='poison'?playerRecipients(step.scope):[owner],events=seats.map(seat=>playerCounterEvent(context.owner,seat,{[step.counter||'poison']:number(step.amount)}));runProgram(g,context,[{op:'counterBatch',events},...rest]);return;}
  if(step.op==='life')for(const seat of playerRecipients(step.scope,owner))gainLife(g,seat,step.amount*(step.expression?effectAmount(g,context,step.expression):1));
  if(step.op==='attackDamage'&&context.event?.defenderTarget){const events=dealDamagePackets(g,[{source:{owner,card:context.source},target:context.event.defenderTarget,amount:step.amount}]);stateBasedActions(g,{damageEvents:events});}
  if(step.op==='landPlays')g.players[owner].extraLandPlays=(g.players[owner].extraLandPlays||0)+step.amount;
  if(step.op==='mana')addMana(g.players[owner],step.counts,{source:context.name});
  if(step.op==='extraCombat')addCombatPhase(g,{mainOnly:step.mainOnly,mainAfter:step.mainAfter,source:context.name,afterSecondMain:!!step.afterSecondMain,...(step.delayedUntap?{beginEffect:{owner,source:context.source,text:step.delayedUntap==='attacked'?'Untap all creatures that attacked this turn.':'Untap all creatures you control.'}}:{})});
  if(step.op==='untapCreatures'){
   const recipients=fieldCards(g).filter(({card,owner:controller})=>isCreature(card)&&(step.scope==='all attacking creatures'?g.combat?.attackers.some(a=>a.id===card.instance):step.scope==='all creatures that attacked this turn'?card.attackHistory?.turn===g.turn+':'+g.active:step.scope==='target creature'?context.targets?.some(t=>t.id===card.instance):controller===owner&&(step.scope!=='all other creatures you control'||card.instance!==context.source.instance)));
   context.lastRecipients=recipients.map(({card})=>({id:card.instance,battlefieldId:card.battlefieldId||null}));for(const {card} of recipients){card.tapped=false;delete card.manaActivation;delete card.tapAbility;}
  }
  if(step.op==='lastKeywords')for(const target of context.lastRecipients||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield'&&(found.card.battlefieldId||null)===target.battlefieldId)grantKeywords(found.card,step.keywords);}
  if(step.op==='addendum'&&[3,9].includes(context.castStep)){const events=(context.lastRecipients||[]).flatMap(target=>{const found=findCard(g,target.id);return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===target.battlefieldId?[permanentCounterEvent(g,context.owner,target.id,{[step.counter]:1})]:[];});runProgram(g,context,[{op:'counterBatch',events},{op:'lastKeywords',keywords:[step.keyword]},...rest]);return;}
  if(step.op==='damage'){
   const targets=(step.scope.startsWith('target')||step.scope==='any target'?context.targets:step.scope==='each creature'?fieldCards(g).filter(({card})=>isCreature(card)).map(({card,owner})=>({kind:'card',id:card.instance,owner,zone:'battlefield',battlefieldId:card.battlefieldId||null})):playerRecipients(step.scope).map(owner=>({kind:'player',owner}))).filter(target=>step.group===undefined||target.group===step.group);
   const events=dealDamagePackets(g,targets.map(target=>({source:{card:context.source,owner},target,amount:(step.expression?effectAmount(g,context,step.expression):step.amount.toUpperCase()==='X'?context.x:Number(step.amount))*(step.multiplier||1)})));queueCombatTriggers(g,events);
  }
  if(step.op==='exileTarget'){
   const target=findCard(g,context.target?.id);if(target?.zone==='battlefield'){
    const controller=target.owner,power=Math.max(0,Number(combatStats(g,controller,target.card)?.power)||0);transfer(g,target.card.instance,'exile',target.card.ownerSeat??controller);
    if(step.imprint){const source=findCard(g,context.source.instance);if(source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null)){source.card.imprintLink={id:target.card.instance,zoneChangeId:target.card.zoneChangeId};refreshLinkedCards(g);}}
    if(step.lifePower)gainLife(g,controller,power);
    if(step.search){runProgram(g,context,[{op:'optional',owner:controller,label:'Search for a basic land',then:[{op:'search',owner:controller,max:1,scope:'basic land',tapped:true}]},...rest]);return;}
   }
  }
  if(step.op==='gift'){
   const target=findCard(g,context.target?.id);if(target?.zone==='battlefield'){const controller=target.owner;removePermanents(g,[target.card.instance]);const token={instance:crypto.randomUUID(),name:step.token.subtype,type_line:'Token Creature — '+step.token.subtype,power:step.token.power,toughness:step.token.toughness,colors:step.token.colors,oracle_text:'',counters:{},token:true};g.players[controller].zones.hand.push(token);transfer(g,token.instance,'battlefield',controller);}
  }
  if(step.op==='warp'){
   const target=findCard(g,context.target?.id);if(target?.zone==='battlefield'){const controller=target.card.ownerSeat??target.owner;transfer(g,target.card.instance,'library',controller);shuffle(g.players[controller].zones.library);const revealed=g.players[controller].zones.library[0];if(revealed){note(g,context.name+' reveals '+revealed.name+'.');if(!/\b(?:Instant|Sorcery)\b/.test(cardFace(revealed).type_line||''))transfer(g,revealed.instance,'battlefield',controller);}}
  }
  if(step.op==='pump'){
   const amount=step.amount?effectAmount(g,context,step.amount):context.x||0;
   const stat=value=>value.includes('X')?(value.startsWith('-')?-1:1)*amount:Number(value);
   const recipients=/^it$/i.test(step.scope)?[findCard(g,context.event?.card?.instance)].filter(f=>f?.zone==='battlefield'&&(f.card.battlefieldId||null)===(context.event.card.battlefieldId||null)):/^(?:another )?target /i.test(step.scope)?(context.targets||[]).filter(t=>t.kind==='card').map(t=>findCard(g,t.id)).filter(f=>f?.zone==='battlefield'):fieldCards(g).filter(({card,owner:controller})=>combatRecipient(g,step.scope,card,controller,context.source,owner));
   context.lastRecipients=recipients.map(({card})=>({id:card.instance,battlefieldId:card.battlefieldId||null}));
   for(const {card} of recipients){card.temporaryStats??={power:0,toughness:0};card.temporaryStats.power+=stat(step.power);card.temporaryStats.toughness+=stat(step.toughness);grantKeywords(card,step.keywords);}
  }
  if(step.op==='counter'){
   const named=selfSubject(step.scope,context.source),subject=named?context.source:context.event?.card;
   if(step.selfOnly&&!named)throw Error('The counter instruction does not refer to this source.');
   const recipients=step.scope==='it'||named?[findCard(g,subject?.instance)].filter(f=>f?.zone==='battlefield'&&(f.card.battlefieldId||null)===(subject.battlefieldId||null)):/^target /i.test(step.scope)?(context.targets||[]).filter(t=>t.kind==='card').map(t=>findCard(g,t.id)).filter(f=>f?.zone==='battlefield'):fieldCards(g).filter(({card,owner:controller})=>(step.scope==='each creature target player controls'?controller===context.target?.owner:controller===owner)&&isCreature(card));
   context.lastRecipients=recipients.map(({card})=>({id:card.instance,battlefieldId:card.battlefieldId||null}));
   const events=recipients.map(({card})=>permanentCounterEvent(g,context.owner,card.instance,{[step.counter]:number(step.amount)}));runProgram(g,context,[{op:'counterBatch',events},...(step.keyword?[{op:'lastKeywords',keywords:[step.keyword]}]:[]),...rest]);return;
  }
  if(step.op==='doubleCounters'){
   const events=(context.targets||[]).filter(t=>t.kind==='card').flatMap(target=>{const found=findCard(g,target.id);return found?.zone==='battlefield'&&(found.card.battlefieldId||null)===target.battlefieldId?[permanentCounterEvent(g,context.owner,target.id,Object.fromEntries(Object.entries(found.card.counters||{}).filter(([,n])=>n>0)))]:[];});runProgram(g,context,[{op:'counterBatch',events},...rest]);return;
  }
  if(step.op==='treasure'){
   const amount=context.event?.amount||0;for(let n=0;n<amount;n++){const card={instance:crypto.randomUUID(),name:'Treasure',token:true,type_line:'Token Artifact — Treasure',oracle_text:'{T}, Sacrifice this artifact: Add one mana of any color.',counters:{}};g.players[owner].zones.hand.push(card);transfer(g,card.instance,'battlefield',owner);}
  }
  if(step.op==='destroy'){
   const removed=removePermanents(g,(context.targets||[]).filter(t=>t.kind==='card').map(t=>t.id));
   if(step.token)for(const result of removed.filter(r=>r.zone==='graveyard')){const token={instance:crypto.randomUUID(),name:step.token.subtype,token:true,type_line:'Token Creature — '+step.token.subtype,power:step.token.power,toughness:step.token.toughness,colors:step.token.colors,oracle_text:'',counters:{}};g.players[result.owner].zones.hand.push(token);transfer(g,token.instance,'battlefield',result.owner);}
  }
  if(step.op==='sweep'){
   const removed=removePermanents(g,fieldCards(g).filter(({card})=>!card.faceDown&&step.types.some(type=>(cardFace(card).type_line||'').includes(type))).map(({card})=>card.instance));const source=findCard(g,context.source.instance);if(step.counterSelf&&source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null)){runProgram(g,context,[{op:'counterBatch',events:[permanentCounterEvent(g,context.owner,source.card.instance,{'+1/+1':removed.length})]},...rest]);return;}
  }
  if(step.op==='fight'){
   const source=findCard(g,context.source.instance),target=findCard(g,context.target?.id);if(source?.zone==='battlefield'&&target?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null)&&isCreature(source.card)&&isCreature(target.card)){
    const events=dealDamagePackets(g,[{source,target:{kind:'card',id:target.card.instance,owner:target.owner},amount:Math.max(0,Number(combatStats(g,source.owner,source.card)?.power)||0)},{source:target,target:{kind:'card',id:source.card.instance,owner:source.owner},amount:Math.max(0,Number(combatStats(g,target.owner,target.card)?.power)||0)}]);stateBasedActions(g,{damageEvents:events});
   }
  }
  if(step.op==='return'){const target=findCard(g,context.target?.id);if(target)transfer(g,target.card.instance,step.zone,target.card.ownerSeat??target.owner);}
  if(step.op==='removeCombat')for(const target of context.targets||[]){const found=findCard(g,target.id);if(found?.zone==='battlefield'&&g.combat){g.combat.attackers=g.combat.attackers.filter(a=>a.id!==target.id);g.combat.blocks=g.combat.blocks.filter(b=>b.attacker!==target.id&&b.blocker!==target.id);g.combat.assignments={};found.card.tapped=false;delete found.card.manaActivation;delete found.card.tapAbility;}}
  if(step.op==='exileGraves')for(const [seat,p] of g.players.entries())if(step.scope==='all'||step.scope==='opponents'&&seat!==owner||step.scope==='target'&&seat===context.target?.owner)for(const c of [...p.zones.graveyard])transfer(g,c.instance,'exile',seat);
  if(step.op==='unblockable'){const target=findCard(g,context.target?.id);if(target?.zone==='battlefield')target.card.temporaryKeywords=[...new Set([...(target.card.temporaryKeywords||[]),'unblockable'])];}
  if(step.op==='attach'){const source=findCard(g,context.source.instance);if(source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null))attachPermanent(g,source.card.instance,context.target?.id);}
  if(step.op==='pumpSelf'){const source=findCard(g,context.source.instance);if(source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null))source.card.temporaryKeywords=[...new Set([...(source.card.temporaryKeywords||[]),...step.keywords])];}
  if(step.op==='skipUntap'){const land=findCard(g,context.event?.card?.instance);if(land?.zone==='battlefield'&&(land.card.battlefieldId||null)===(context.event.card.battlefieldId||null))land.card.skipNextUntap=true;}
  if(step.op==='repeatDamage'){if(context.target){const events=dealDamagePackets(g,[{source:{owner,card:context.source},target:context.target,amount:context.event?.amount||0}]);stateBasedActions(g,{damageEvents:events});}}
  if(step.op==='chargeX'){const source=findCard(g,context.source.instance);if(source?.zone==='battlefield'&&(source.card.battlefieldId||null)===(context.source.battlefieldId||null)){runProgram(g,context,[{op:'counterBatch',events:[permanentCounterEvent(g,context.owner,source.card.instance,{charge:context.x})]},...rest]);return;}}
  if(step.op==='destroyManaValue')removePermanents(g,fieldCards(g).filter(({card})=>!card.faceDown&&!/\bLand\b/.test(cardFace(card).type_line||'')&&(card.cmc||0)===(context.source.counters?.charge||0)).map(({card})=>card.instance));
  if(step.op==='destroyAndSearch'){
   removePermanents(g,[context.target?.id]);const owners=step.who==='each'?g.players.map((_,i)=>(i+g.active)%g.players.length):[context.target.owner];runProgram(g,context,[...owners.map(owner=>step.who==='controller'?{op:'optional',owner,label:'Search for a basic land',then:[{op:'search',owner,scope:'basic land',max:1,tapped:false}]}:{op:'search',owner,scope:'basic land',max:1,tapped:false}),...rest]);return;
  }
  if(step.op==='exileOne'){runProgram(g,context,[{op:'selectMove',owner:context.target.owner,zone:'graveyard',to:'exile',max:1,min:1},...rest]);return;}
 }catch(error){if(!error?.destructionPause)throw error;g.pendingEffect.continuation={context,program:program.slice(i)};return;}
 }
 if(context.spellId&&findCard(g,context.spellId)?.zone==='stack')finishSpell(g,context.spellId);
 stateBasedActions(g);finishResolutionTriggers(g);
}
// ---- Choices made while a spell or ability is resolving ----
export function oracleChoiceOptions(g){
 const pending=g.pendingEffect;if(pending?.kind!=='oracle-choice')return [];const {step,owner}=pending;
 const reanimationOptions=reanimationChoiceOptions(g,pending);if(reanimationOptions!==null)return reanimationOptions;
 const permissionOptions=permissionChoiceOptions(g,pending);if(permissionOptions!==null)return permissionOptions;
 if(step.op==='miracleReveal')return [{key:'yes',label:'Reveal for miracle'},{key:'no',label:'Keep it private'}];
 if(step.op==='soulbond')return soulbondOptions(g,owner,pending.context.source,pending.context.event).map(card=>({key:card.instance,label:'Pair with '+card.name,zone:'battlefield'}));
 if(step.op==='drawCount')return Array.from({length:step.amount+1},(_,n)=>({key:String(n),label:'Draw '+n+' card(s)'}));
 const libraryOptions=libraryChoiceOptions(g,pending);if(libraryOptions!==null)return libraryOptions;
 if(step.op==='castExiled'||step.op==='castOffered')return [];
 if(step.op==='chooseManaColor')return ['W','U','B','R','G'].map(key=>({key,label:'Add '+step.amount+' '+key+' mana'}));
 if(step.op==='myriad')return tokenDefenders(g,owner).filter(t=>step.defenders.includes(t.owner));
 if(step.op==='chooseCounters')return g.players[owner].zones.battlefield.filter(isCreature).map(card=>({key:card.instance,label:card.name,zone:'battlefield'}));
 if(step.op==='retargetCopy'){const entry=g.stack.find(e=>e.card?.instance===step.id&&e.card.zoneChangeId===step.zoneChangeId);return entry?effectTargetOptions(g,{...entry,text:entry.spellText||cardFace(entry.card).oracle_text}):[];}
 if(step.op==='chooseUntapLands')return fieldCards(g).filter(({card})=>!card.faceDown&&/\bLand\b/.test(cardFace(card).type_line||'')).map(({card,owner})=>({key:card.instance,label:g.players[owner].name+' - '+card.name,zone:'battlefield'}));
 if(step.op==='chooseExiled')return step.cards.flatMap(ref=>{const found=findCard(g,ref.id);return found?.zone===(step.zone||'exile')&&(found.card.zoneChangeId||null)===ref.zoneChangeId?[{key:ref.id,label:found.card.name,zone:step.zone||'exile'}]:[];});
 if(step.op==='orderGraveBottom')return step.ids.flatMap(id=>{const found=findCard(g,id);return found?.zone==='graveyard'?[{key:id,label:found.card.name,zone:'graveyard'}]:[];});
 if(step.op==='sacrificeReflexive')return g.players[owner].zones.battlefield.filter(card=>isCreature(card)&&!(card.instance===pending.context.source.instance&&(card.battlefieldId||null)===(pending.context.source.battlefieldId||null))).map(card=>({key:card.instance,label:'Sacrifice '+card.name,zone:'battlefield'}));
 if(step.op==='announceModes')return step.modes.map((label,i)=>({key:String(i),label}));
 if(step.op==='optional')return [{key:'yes',label:step.label},{key:'no',label:'Decline'}];
 if(step.op==='optionalPay')return [...(paymentPlan(g.players[owner],pending.context.source,step.cost,{ability:true})?[{key:'yes',label:'Pay '+step.cost}]:[]),{key:'no',label:'Decline'}];
 if(step.op==='mode')return step.modes.map((mode,i)=>({key:String(i),label:mode.label}));
 if(step.op==='tokenDefenders')return tokenDefenders(g,owner,step.tokens[0].defender).map(target=>({...target,label:'Attack '+target.label}));
 if(step.op==='scry'||step.op==='orderTop')return step.ids.flatMap(id=>{const card=g.players[owner].zones.library.find(c=>c.instance===id);return card?[{key:id,label:cardFace(card).name||card.name,zone:'library'}]:[];});
 const zone=step.zone||(step.op==='search'?'library':'hand');return g.players[owner].zones[zone].filter(c=>{
  const type=cardFace(c).type_line||'';return step.scope==='card'||step.op==='discard'?true:step.op==='selectMove'?!step.scope||step.scope==='permanent'||new RegExp('\\b'+step.scope+'\\b','i').test(c.faceDown?'Creature':type):step.op==='freeCast'?!/\bLand\b/.test(type)&&c.mana_cost!==undefined&&c.mana_cost!==''&&c.cmc<=step.manaValue:step.op==='deploy'?new RegExp('\\b'+(step.scope||'Creature')+'\\b','i').test(type):['creature','Equipment','Aura','Aura or Equipment','instant or sorcery'].includes(step.scope)?step.scope.split(' or ').some(t=>new RegExp('\\b'+t+'\\b','i').test(type)):step.scope==='basic land'?/\bBasic\b/.test(type)&&/\bLand\b/.test(type):step.scope==='Forest'?/\bForest\b/.test(type):/\bLand\b/.test(type);
 }).map(c=>({key:c.instance,label:c.name,zone}));
}
export function resolveOracleChoice(g,keys=[]){
 if(!Array.isArray(keys)||keys.length>500||keys.some(key=>typeof key!=='string'))throw Error('Choose available cards or options.');
 const pending=g.pendingEffect;if(pending?.kind!=='oracle-choice')throw Error('No card choice is pending.');if(resolveSecretNumber(g,pending,keys,runProgram))return;if(pending.step.op==='retargetCopy'){const entry=g.stack.find(e=>e.card?.instance===pending.step.id&&e.card.zoneChangeId===pending.step.zoneChangeId);if(!entry)throw Error('The spell copy is no longer on the stack.');if(keys.length)Object.assign(entry,retargetCopy(g,entry,keys));recordPlay(g,{kind:'copy',owner:entry.owner,source:entry.card,text:entry.spellText,targets:entry.targets||[],stackId:entry.card.instance});delete g.pendingEffect;runProgram(g,pending.context,pending.remaining);return;}const {context,step,remaining,owner}=pending,options=oracleChoiceOptions(g),unique=[...new Set(keys)];
 if(unique.length!==keys.length||unique.some(k=>!options.some(o=>o.key===k)))throw Error('Choose available cards or options.');
 if(['optional','optionalPay','miracleReveal'].includes(step.op)&&(unique.length!==1||!['yes','no'].includes(unique[0])))throw Error('Accept or decline the optional effect.');
 if(step.op==='mode'&&unique.length!==1)throw Error('Choose one mode.');
 if(step.op==='announceModes'&&unique.length!==step.count)throw Error('Choose exactly '+step.count+' modes.');
 if(step.op==='discard'&&unique.length!==Math.min(step.max,options.length))throw Error('Choose '+Math.min(step.max,options.length)+' cards to discard.');
 if(step.max!==undefined&&unique.length>step.max)throw Error('Choose at most '+step.max+' cards.');
 if(step.min!==undefined&&unique.length<Math.min(step.min,options.length))throw Error('Choose at least '+Math.min(step.min,options.length)+' cards.');
 if(step.sharedType&&unique.length>1){const types=unique.map(id=>(cardFace(findCard(g,id).card).type_line.split('—')[1]||'').trim().split(/\s+/).filter(Boolean));if(!types[0].some(type=>types.every(list=>list.includes(type))))throw Error('These lands must share a land subtype.');}
 if(step.op==='myriad'&&new Set(unique.map(key=>options.find(o=>o.key===key).owner)).size!==unique.length)throw Error('Choose at most one defender for each opponent.');
 delete g.pendingEffect;
 if(resolveReanimationChoice(g,pending,unique,runProgram))return;
 if(resolvePermissionChoice(g,pending,unique,runProgram))return;
 if(step.op==='miracleReveal'){const found=findCard(g,step.id);if(unique[0]==='yes'&&found?.zone==='hand'&&found.owner===owner&&found.card.zoneChangeId===step.zoneChangeId){recordPlay(g,{kind:'reveal',owner,source:found.card,text:'Revealed for miracle '+step.cost+'.'});queueCombatTriggers(g,[{kind:'miracle',owner,card:snapshotCard(found.card),cost:step.cost}]);}runProgram(g,context,remaining);return;}
 if(step.op==='soulbond'){if(unique.length)pairCreatures(g,owner,context.source,context.event,unique[0]);runProgram(g,context,remaining);return;}
 if(step.op==='chooseManaColor'){addMana(g.players[owner],{[unique[0]]:step.amount},{source:context.name});runProgram(g,context,remaining);return;}
 if(step.op==='drawCount'){runProgram(g,context,[{op:'draw',owner,amount:unique[0]},...remaining]);return;}
 if(step.op==='sacrificeChoice'){removePermanents(g,unique,{sacrifice:true});runProgram(g,context,remaining);return;}
 if(resolveLibraryChoice(g,pending,unique,runProgram))return;
 if(step.op==='chooseUntapLands'){for(const id of unique){const found=findCard(g,id);found.card.tapped=false;delete found.card.manaActivation;delete found.card.tapAbility;}runProgram(g,context,remaining);return;}
 if(step.op==='orderGraveBottom'){for(const id of unique)transfer(g,id,'library',findCard(g,id).card.ownerSeat??owner);runProgram(g,context,remaining);return;}
 if(step.op==='sacrificeReflexive'){if(!unique.length){runProgram(g,context,remaining);return;}const before=g.stack.length;removePermanents(g,unique,{sacrifice:true});const waiting=g.stack.splice(before);g.pendingEffect={kind:'oracle-choice',owner,name:pending.name,context,step:{op:'announceModes',modes:step.modes,count:step.count,waiting,min:step.count,max:step.count},remaining};return;}
 if(step.op==='announceModes'){const text=step.modes.filter((_,i)=>unique.includes(String(i))).join('\n');queueReflexiveTrigger(g,context,text,step.waiting);runProgram(g,context,remaining);return;}
 if(step.op==='chooseExiled'){if(!unique.length){runProgram(g,context,remaining);return;}const chosen=step.cards.find(c=>c.id===unique[0]);g.pendingEffect={kind:'oracle-choice',owner,name:pending.name,context,step:{op:'castOffered',zone:step.zone||'exile',id:chosen.id,zoneChangeId:chosen.zoneChangeId,scope:step.scope,manaValue:step.manaValue,graveyardExile:!!step.graveyardExile,trackForCopies:!!step.trackForCopies,min:0,max:0},remaining:[{...step,cards:step.cards.filter(c=>c.id!==chosen.id)},...remaining]};return;}
 if(step.op==='chooseCounters'){runProgram(g,context,[{op:'counterBatch',events:unique.map(id=>permanentCounterEvent(g,context.owner,id,{[step.counter]:number(step.amount)}))},...remaining]);return;}
 if(step.op==='myriad'){const created=createTokens(g,owner,tokenCopyDefinition(context.source),unique.length,{tapped:true}),tokens=[];for(const [index,card] of created.entries()){enterAttacking(g,card.instance,options.find(o=>o.key===unique[index]));tokens.push({id:card.instance,battlefieldId:card.battlefieldId});}if(tokens.length&&g.combat)(g.combat.endTriggers??=[]).push({owner,source:context.source,tokens});runProgram(g,context,remaining);return;}
 if(step.op==='castExiled'||step.op==='castOffered'){const first=remaining[0],found=findCard(g,step.id);if(first?.op==='chooseExiled'&&found?.zone===(step.zone||'exile')&&(found.card.zoneChangeId||null)===step.zoneChangeId)runProgram(g,context,[{...first,cards:[...first.cards,{id:step.id,zoneChangeId:step.zoneChangeId}]},...remaining.slice(1)]);else runProgram(g,context,remaining);return;}
 if(step.op==='tokenDefenders'){
  const target=options.find(option=>option.key===unique[0]);if(target)enterAttacking(g,step.tokens[0].id,target);
  runProgram(g,context,[...(step.tokens.length>1?[{...step,tokens:step.tokens.slice(1)}]:[]),...remaining]);return;
 }
 if(step.op==='optional'||step.op==='optionalPay'){if(step.op==='optionalPay'&&unique[0]==='yes')payMana(g.players[owner],context.source,step.cost,{ability:true});runProgram(g,context,[...(unique[0]==='yes'?step.then:step.otherwise||[]),...remaining]);return;}
 if(step.op==='mode'){runProgram(g,context,[...step.modes[Number(unique[0])].program,...remaining]);return;}
 if(step.op==='scry'){
  const player=g.players[owner],bottom=unique.map(id=>player.zones.library.find(c=>c.instance===id)),top=step.ids.filter(id=>!unique.includes(id));player.zones.library=player.zones.library.filter(c=>!unique.includes(c.instance));player.zones.library.push(...bottom);
  note(g,g.players[owner].name+' scries '+step.ids.length+'; puts '+unique.length+' on the bottom.');
  runProgram(g,context,[...(top.length>1?[{op:'orderTop',ids:top,min:top.length,max:top.length}]:[]),...remaining]);return;
 }
 if(step.op==='orderTop'){const player=g.players[owner],top=unique.map(id=>player.zones.library.find(c=>c.instance===id));player.zones.library=[...top,...player.zones.library.filter(c=>!unique.includes(c.instance))];runProgram(g,context,remaining);return;}
 if(step.op==='discard'){for(const id of unique)transfer(g,id,'graveyard',owner);runProgram(g,context,remaining);return;}
 if(step.op==='selectMove'){for(const id of unique){const card=findCard(g,id).card;transfer(g,id,step.to,step.originalOwner?(card.ownerSeat??owner):owner);}runProgram(g,context,remaining);return;}
 if(step.op==='freeCast'){
  if(!unique.length){runProgram(g,context,remaining);return;}const card=findCard(g,unique[0]).card;g.pendingEffect={kind:'oracle-choice',owner,name:pending.name,context,step:{op:'castOffered',zone:'hand',id:card.instance,zoneChangeId:card.zoneChangeId||null,manaValue:step.manaValue,min:0,max:0},remaining};return;
 }
 for(const [index,id] of unique.entries()){if(step.reveal||step.split){const chosen=findCard(g,id).card;recordPlay(g,{kind:'reveal',owner,source:chosen,text:context.name+' reveals '+unique.map(id=>findCard(g,id)?.card.name).join(', ')+'.'});}const to=step.to||(step.split&&index>0?'hand':'battlefield');transfer(g,id,to,owner,undefined,{entryTapped:!!step.tapped});}
 if(step.op==='search')shuffle(g.players[owner].zones.library);
 note(g,pending.name+': '+unique.length+' card(s) chosen'+(step.op==='search'?'; library shuffled.':'.'));runProgram(g,context,remaining);
}
export function validateOracleChoice(pending,fail,playerCount=4){
 if(pending?.kind==='counter-choice'){validateCounterPlan(pending.plan,fail,playerCount);const choice=advanceCounterPlan(structuredClone(pending.plan));if(!choice||choice.owner!==pending.owner)fail();validateOracleChoice({kind:'oracle-choice',owner:pending.owner,name:pending.name,context:pending.context,step:{op:'optional',label:'Resume after counters',then:pending.remaining},remaining:[]},fail,playerCount);return;}
 if(pending?.kind==='proliferate'&&pending.context){validateOracleChoice({kind:'oracle-choice',owner:pending.owner,name:pending.name,context:pending.context,step:{op:'optional',label:'Resume after proliferating',then:pending.remaining},remaining:[]},fail,playerCount);return;}
 if(pending?.kind==='destruction-choice'){
  const seat=n=>Number.isInteger(n)&&n>=0&&n<playerCount;
  if(!seat(pending.owner)||typeof pending.id!=='string'||!pending.resume||!['remove','sba'].includes(pending.resume.kind)||pending.resume.kind==='remove'&&(!Array.isArray(pending.resume.ids)||pending.resume.ids.length>500||pending.resume.ids.some(id=>typeof id!=='string'))||pending.resume.kind==='sba'&&!Array.isArray(pending.resume.damageEvents))fail();
  if(pending.continuation)validateOracleChoice({kind:'oracle-choice',owner:pending.owner,name:pending.name,context:pending.continuation.context,step:{op:'optional',label:'Resume destruction',then:pending.continuation.program},remaining:[]},fail,playerCount);
  return;
 }
 if(pending?.kind!=='oracle-choice')return;
 const seat=n=>Number.isInteger(n)&&n>=0&&n<playerCount,integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999,string=s=>typeof s==='string'&&s.length<=3000;
 const context=pending.context;if(!context||!seat(context.owner)||!context.source||!string(context.source.instance)||!string(context.source.name)||context.spellId!==undefined&&!string(context.spellId)||context.x!==undefined&&!integer(context.x)||!pending.step||![...LIBRARY_CHOICES,'orderCopies','chooseGraveCast','victimize','miracleReveal','secretNumber','castOffered','chooseManaColor','drawCount','castExiled','search','deploy','optional','optionalPay','mode','freeCast','discard','selectMove','sacrificeChoice','soulbond','scry','orderTop','tokenDefenders','myriad','chooseCounters','chooseExiled','sacrificeReflexive','announceModes','orderGraveBottom','chooseUntapLands','retargetCopy'].includes(pending.step.op))fail();
 const target=t=>{if(!t||!['card','player'].includes(t.kind)||!seat(t.owner)||t.kind==='card'&&!string(t.id))fail();};if(context.target)target(context.target);if(context.targets){if(!Array.isArray(context.targets)||context.targets.length>100)fail();context.targets.forEach(target);}
 if(context.announcedTargets){if(!Array.isArray(context.announcedTargets)||context.announcedTargets.length>100)fail();context.announcedTargets.forEach(target);}if(context.activeTargetGroup!==undefined&&context.activeTargetGroup!==null&&!integer(context.activeTargetGroup))fail();
 let nodes=0;
 for(const refs of [context.copyOrder])if(refs!==undefined&&(!Array.isArray(refs)||refs.length>500||refs.some(ref=>!string(ref.id)||!string(ref.zoneChangeId))))fail();
 if(context.offeredSpells!==undefined&&(!Array.isArray(context.offeredSpells)||context.offeredSpells.length>500||context.offeredSpells.some(ref=>!string(ref.id)||!string(ref.zoneChangeId))))fail();
 const operations=[...REANIMATION_OPERATIONS,'doubleCounters','counterBatch','graveCount','destroyAndLoseLife','resumeDraw','miracleReveal',...SECRET_OPERATIONS,'targetLoot','targetTreasure',...LIBRARY_OPERATIONS,...TEMPORAL_OPERATIONS,'destroyOpposing','copyEventSpells',...PERMISSION_OPERATIONS,'castOffered','chooseManaColor','scaledMana','grantFlashback','playerCounter','manifestTarget','returnSpells','temporaryMana','bounce','bounceAttackers','tapOpponents','kickedDraw','targetDraw','shuffleSelf','copySpell','returnStackTarget','retargetCopy','transformSelf','counterSpell','counterUnless','counterControllerToken','chooseUntapLands','untapTargets','bottomTargets','attachSelfToEvent','orderGraveBottom','creatureDamage','proliferate','controlBlocks','sacrificeReflexive','announceModes','exileToCast','chooseExiled','attackingDraw','chooseCounters','goadTarget','creatureControllerDamage','myriad','exileTrackedTokens','win','loseKeywords','blockLimit','animateVehicle','exileLinked','removeCombat','conditionalPump','createTokens','tokenDefenders','scry','orderTop','extraCombat','untapCreatures','lastKeywords','poison','life','landPlays','mana','damage','exileTarget','gift','warp','draw','pump','counter','treasure','destroy','sweep','fight','return','exileGraves','unblockable','attach','pumpSelf','skipUntap','repeatDamage','chargeX','destroyManaValue','destroyAndSearch','exileOne','search','deploy','optional','optionalPay','mode','freeCast','discard','selectMove','sacrificeChoice','soulbond'];
 const program=(steps,depth)=>{if(!Array.isArray(steps)||steps.length>100||depth>6)fail();steps.forEach(step=>check(step,depth));};
 const check=(step,depth)=>{
  if(++nodes>500||!step||!operations.includes(step.op)&&!['attachEventEquipment','attachToEventCreature','returnEventFromGraveyard','untapLands','unlessPay','addendum','exileToPlay','reboundCast','castExiled','dividedDamage','untapSelf','tapTarget','destroyDamagedManaValue','attackDamage'].includes(step.op)||step.owner!==undefined&&!seat(step.owner)||['max','min','manaValue'].some(key=>step[key]!==undefined&&!integer(step[key])))fail();
  if(step.op==='sacrificeChoice'&&(step.scope!=='land'||step.zone!=='battlefield'||step.min!==1||step.max!==1))fail();
  if(step.op==='delayedCopy'&&(!['next','each'].includes(step.mode)||!['controller','all'].includes(step.scope)))fail();
  if(['copySpell','copyEventSpells'].includes(step.op)&&(step.left!==undefined&&(!integer(step.left)||step.left>500)||step.colors!==undefined&&(!Array.isArray(step.colors)||step.colors.some(c=>!['W','U','B','R','G','C'].includes(c)))))fail();
  if(step.op==='revealedToHand'&&(!string(step.id)||step.zoneChangeId!==null&&!string(step.zoneChangeId)))fail();
  if(step.targetGroup!==undefined&&step.targetGroup!==null&&!integer(step.targetGroup))fail();
  if(step.op==='targetLoot'&&(!integer(step.draw)||!integer(step.discard)||step.draw>100||step.discard>100))fail();
  if(step.op==='secretNumber'&&(!Array.isArray(step.participants)||step.participants.length!==new Set(step.participants).size||step.participants.some(n=>!seat(n))||!integer(step.index)||step.index>=step.participants.length||step.values===undefined||typeof step.values!=='object'||Array.isArray(step.values)||Object.entries(step.values).some(([key,n])=>!step.participants.includes(Number(key))||!integer(n))))fail();
  if(step.op==='wheelNumbers'&&(!step.values||typeof step.values!=='object'||Array.isArray(step.values)||Object.entries(step.values).some(([key,n])=>!seat(Number(key))||!integer(n))))fail();
  if(step.op==='wheelDraw'&&step.amount!==7)fail();
  if(step.op==='miracleReveal'&&(!string(step.id)||!string(step.zoneChangeId)||!string(step.cost)||!/^(?:\{[^}]+\})+$/.test(step.cost)))fail();
  if(step.op==='resumeDraw'&&(!Array.isArray(step.work)||step.work.length>1000||step.work.some(t=>!integer(t.count)||!Array.isArray(t.applied)||t.applied.length>1000||t.applied.some(id=>!string(id)))))fail();
  if(step.op==='castOffered'&&step.cost!==undefined&&(!string(step.cost)||!/^(?:\{[^}]+\})+$/.test(step.cost)))fail();
  if(step.op==='graveCount'){if(!integer(step.minimum))fail();program(step.then,depth+1);program(step.otherwise,depth+1);}
  if(step.op==='reanimate'&&typeof step.loseLife!=='boolean')fail();
  if(step.op==='temporaryGraveyard'&&!['play','exile'].includes(step.kind))fail();
  if(step.op==='drawCount'&&(!integer(step.amount)||step.amount>100))fail();
  if(step.op==='delayDraw'&&(!['you','countered'].includes(step.recipient)||!integer(step.amount)||typeof step.optional!=='boolean'))fail();
  if(step.op==='cumulativeUpkeep'&&(!string(step.cost)||!/^(?:\{[0-9WUBRGC]+\})+$/.test(step.cost)))fail();
  if(['ceaseCopies','graveExiled'].includes(step.op)&&(!Array.isArray(step.cards)||step.cards.length>500||step.cards.some(ref=>!string(ref.id)||!string(ref.zoneChangeId))))fail();
  if(['exilePlay','handMana','chooseManaColor'].includes(step.op)&&(!integer(step.amount)||step.amount>500||['free','spellsOnly'].some(k=>step[k]!==undefined&&typeof step[k]!=='boolean')))fail();
  if(step.op==='counterBatch'&&(!Array.isArray(step.events)||step.events.length>500||step.events.some(e=>!e||!seat(e.actor)||!seat(e.recipient?.owner)||!['card','player'].includes(e.recipient.kind)||!['effect','entry','cost','damage'].includes(e.cause)||e.recipient.kind==='card'&&(!string(e.recipient.id)||e.recipient.battlefieldId!==null&&!string(e.recipient.battlefieldId))||!e.counters||Array.isArray(e.counters)||Object.entries(e.counters).some(([kind,n])=>!kind||kind.length>100||!integer(n)))))fail();
  if(step.op==='copyOfferedSpells'&&(!integer(step.threshold)||!integer(step.amount)||step.amount>500))fail();
  if(step.op==='copySpell'&&(step.amount!==undefined&&(!integer(step.amount)||step.amount>500)||step.target!==undefined&&(!string(step.target.id)||!string(step.target.zoneChangeId))))fail();
  if(['castOffered','chooseExiled'].includes(step.op)&&(['graveyardExile','trackForCopies'].some(k=>step[k]!==undefined&&typeof step[k]!=='boolean')||step.zone!==undefined&&!['hand','exile','library','graveyard'].includes(step.zone)))fail();
  if(step.op==='copyEventSpells'&&(!['allBefore','ownBefore','one'].includes(step.count)||step.left!==undefined&&(!integer(step.left)||step.left>500)))fail();
  if(['damage','targetDraw'].includes(step.op)&&(step.group!==undefined&&!integer(step.group)||step.multiplier!==undefined&&(!integer(step.multiplier)||step.multiplier<1)))fail();
  if(step.op==='scaledMana'&&(!['W','U','B','R','G','C'].includes(step.color)||!['targetHand','tappedOpponentLands'].includes(step.count)))fail();
  if(step.op==='transformSelf'&&(!integer(step.count)||!string(step.subtype)))fail();
  if(step.op==='counterUnless'&&(!string(step.cost)||!/^\{\d+\}$/.test(step.cost)))fail();
  if(step.op==='orderGraveBottom'&&(!Array.isArray(step.ids)||step.ids.length>4||step.ids.some(id=>!string(id))))fail();
  if(['attackingDraw','creatureControllerDamage'].includes(step.op)&&(!integer(step.amount)||step.life!==undefined&&!Number.isSafeInteger(step.life)))fail();
  if(step.op==='chooseCounters'&&(!string(step.counter)||!string(step.amount)||step.zone!=='battlefield'))fail();
  if(step.op==='myriad'&&step.defenders!==undefined&&(!Array.isArray(step.defenders)||step.defenders.some(n=>!seat(n))))fail();
  if(step.op==='chooseExiled'&&(!Array.isArray(step.cards)||step.cards.length>500||step.cards.some(c=>!string(c.id)||c.zoneChangeId!==null&&!string(c.zoneChangeId))))fail();
  if(['sacrificeReflexive','announceModes'].includes(step.op)&&(!Array.isArray(step.modes)||step.modes.length>10||step.modes.some(mode=>!string(mode))||!integer(step.count)||step.count<1||step.count>step.modes.length||step.waiting!==undefined&&!Array.isArray(step.waiting)))fail();
  if(step.op==='attackDamage'&&!integer(step.amount))fail();
  if(step.op==='dividedDamage'&&(typeof step.tapCreatures!=='boolean'||typeof step.restrictNoncreature!=='boolean'))fail();
  if(LIBRARY_OPERATIONS.includes(step.op)&&(['amount','take'].some(k=>step[k]!==undefined&&!integer(step[k]))||step.ids!==undefined&&(!Array.isArray(step.ids)||step.ids.length>100||step.ids.some(id=>!string(id)))||step.op==='viewHand'&&step.target!==undefined&&!seat(step.target)||step.op==='choosePile'&&(!Array.isArray(step.piles)||step.piles.length!==2||step.piles.some(ids=>!Array.isArray(ids)||ids.length>100||ids.some(id=>!string(id))))))fail();
  if(step.op==='castOffered'&&(!['hand','exile','library','graveyard'].includes(step.zone)||!string(step.id)||step.zoneChangeId!==null&&!string(step.zoneChangeId)))fail();
  if(step.op==='castExiled'&&(!string(step.id)||!string(step.zoneChangeId)))fail();
  if(step.op==='retargetCopy'&&(!string(step.id)||!string(step.zoneChangeId)))fail();
  if(step.op==='addendum'&&(!/^[+-]\d+\/[+-]\d+$/.test(step.counter)||!string(step.keyword)))fail();
  if(step.op==='unlessPay'){if(step.amount!=='source power'&&!/^\{\d+\}$/.test(step.cost||''))fail();program(step.then,depth+1);}
  if(step.op==='mode'){if(!Array.isArray(step.modes)||!step.modes.length||step.modes.length>10)fail();for(const mode of step.modes){if(!mode||!string(mode.label))fail();program(mode.program,depth+1);}}
  if(step.op==='createTokens'&&(!string(step.amount)||!step.definition||!string(step.definition.name)||!string(step.definition.type_line)||typeof step.definition.oracle_text!=='string'))fail();
  if(step.op==='conditionalPump'&&(!Number.isSafeInteger(step.power)||!Number.isSafeInteger(step.toughness)||!Array.isArray(step.grants)||step.grants.some(grant=>!string(grant.keyword)||!['white','blue','black','red','green'].includes(grant.color))))fail();
  if(step.op==='tokenDefenders'&&(!Array.isArray(step.tokens)||!step.tokens.length||step.tokens.length>500||step.tokens.some(token=>!string(token.id)||token.defender!==undefined&&!seat(token.defender))))fail();
  if(step.op==='optional'||step.op==='optionalPay'){if(step.op==='optional'&&!string(step.label)||step.op==='optionalPay'&&(!string(step.cost)||! /^(?:\{(?:\d+|[WUBRGCSX])\})+$/.test(step.cost)))fail();program(step.then,depth+1);if(step.otherwise!==undefined)program(step.otherwise,depth+1);}
  if(step.op==='blockLimit'&&(!integer(step.amount)||step.amount<1))fail();
  if(step.op==='deploy'&&step.scope!==undefined&&!['Equipment','Aura','artifact','enchantment','creature','land'].includes(step.scope))fail();
  if(step.op==='search'&&(!['card','creature','basic land','Forest','land','Equipment','Aura','Aura or Equipment','instant or sorcery'].includes(step.scope)||!integer(step.max)||step.max>3||step.to!==undefined&&!['hand','graveyard'].includes(step.to)))fail();
  if(step.op==='selectMove'&&(!(step.zone==='graveyard'&&step.to==='exile'&&!step.scope&&!step.originalOwner)&&!(step.zone==='battlefield'&&step.to==='hand'&&step.originalOwner===true&&['land','artifact','creature','enchantment','permanent'].includes(step.scope))))fail();
  if(step.op==='playerCounter'&&(!string(step.counter)||!string(step.amount)||!Number.isSafeInteger(number(step.amount))))fail();
  if(step.op==='draw'&&!string(step.amount))fail();
  if(step.op==='scry'&&(!/^\d+$/.test(step.amount)||Number(step.amount)>999999)||['scry','orderTop'].includes(step.op)&&step.ids!==undefined&&(!Array.isArray(step.ids)||step.ids.length>500||step.ids.some(id=>!string(id))||new Set(step.ids).size!==step.ids.length)||step.op==='orderTop'&&!Array.isArray(step.ids))fail();
  if(step.op==='extraCombat'&&(typeof step.mainOnly!=='boolean'||typeof step.mainAfter!=='boolean'||step.afterSecondMain!==undefined&&typeof step.afterSecondMain!=='boolean'||step.delayedUntap!==undefined&&!['all','attacked'].includes(step.delayedUntap)))fail();
  if(step.op==='untapCreatures'&&!['all creatures you control','all other creatures you control','all creatures that attacked this turn','all attacking creatures','target creature'].includes(step.scope))fail();
  if(step.op==='lastKeywords'&&(!Array.isArray(step.keywords)||step.keywords.some(k=>!string(k))))fail();
  if(['poison','life'].includes(step.op)&&(!['you','each opponent','each player','target player','target opponent','that player'].includes(step.scope)||step.op==='poison'&&(!string(step.amount)||!Number.isSafeInteger(number(step.amount)))||step.op==='life'&&(!Number.isSafeInteger(step.amount)||Math.abs(step.amount)>999999)))fail();
  if(step.op==='landPlays'&&!integer(step.amount))fail();
  if(step.op==='mana'&&(!step.counts||Object.entries(step.counts).some(([t,n])=>!['W','U','B','R','G','C'].includes(t)||!integer(n))))fail();
  if(step.op==='damage'&&(!/^(?:\d+|X)$/i.test(step.amount)||!['target creature with flying','target attacking or blocking creature','target player or planeswalker','target creature or planeswalker','target creature','target planeswalker','target player','target opponent','any target','each opponent','each player'].includes(step.scope)))fail();
  if(step.op==='gift'&&(!step.token||!/^\d+$/.test(step.token.power)||!/^\d+$/.test(step.token.toughness)||!string(step.token.subtype)||!Array.isArray(step.token.colors)||step.token.colors.some(c=>!['W','U','B','R','G'].includes(c))))fail();
  if(step.op==='pump'&&(!string(step.scope)||![step.power,step.toughness].every(s=>typeof s==='string'&&/^[+-]?(?:\d+|X)$/.test(s))||!Array.isArray(step.keywords)||step.keywords.some(s=>!string(s))))fail();
  if(step.op==='counter'&&(!string(step.counter)||!string(step.amount)||!string(step.scope)))fail();
  if(step.op==='pumpSelf'&&(!Array.isArray(step.keywords)||step.keywords.some(s=>!string(s))))fail();
  if(step.op==='return'&&!['hand','exile','battlefield'].includes(step.zone))fail();
  if(step.op==='sweep'&&(!Array.isArray(step.types)||step.types.some(s=>!string(s))))fail();
 };
 check(pending.step,0);program(pending.remaining,0);
}
export function continueOracleCast(g,pending){if(pending.step?.trackForCopies){const entry=g.stack.find(e=>e.card?.instance===pending.step.id);if(entry)(pending.context.offeredSpells??=[]).push({id:entry.card.instance,zoneChangeId:entry.card.zoneChangeId});}runProgram(g,pending.context,pending.remaining);}

// ---- Counter replacement continuation ----
// The affected player can differ from the spell's controller. Keep the original
// context when handing the choice off, then resume the spell exactly once.
export function counterChoiceOptions(g){if(g.pendingEffect?.kind!=='counter-choice')return [];return advanceCounterPlan(structuredClone(g.pendingEffect.plan))?.options||[];}
export function resolveCounterChoice(g,key){const pending=g.pendingEffect;if(pending?.kind!=='counter-choice')throw Error('No counter replacement is pending.');const choice=advanceCounterPlan(pending.plan,key);if(choice){pending.owner=choice.owner;return;}delete g.pendingEffect;commitCounterPlan(g,pending.plan);runProgram(g,pending.context,pending.remaining);}
