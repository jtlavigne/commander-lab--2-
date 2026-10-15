import {cardFace,manaValue} from './card-state.mjs';
import {findCard} from './engine.mjs';
import {fieldCards,isCreature,keywordSet,protectedFrom,combatStats} from './creature-rules.mjs';

export function effectTargetSpec(text,choices={}){
 let m;
 if(/any number of target permanents/i.test(text))return {kind:'card',zone:'battlefield',types:['permanent'],optional:true,max:100};
 if(/up to one target instant card and\/or up to one target sorcery card from your graveyard each with mana value X or less/i.test(text))return {kind:'card',groups:[{text:'target instant card from your graveyard with mana value X or less.',label:'Instant'},{text:'target sorcery card from your graveyard with mana value X or less.',label:'Sorcery'}],optional:true,optionalGroups:true,repeated:true,min:0,max:2};
 if(/Choose two target creature cards in your graveyard\./i.test(text))return {kind:'card',zone:'graveyard',types:['creature'],own:true,min:2,max:2};
 if(/target instant or sorcery card in your graveyard/i.test(text))return {kind:'card',zone:'graveyard',types:['instant','sorcery'],own:true,max:1};
 if((m=text.match(/target (creature|instant|sorcery) card (?:from|in) (your|a) graveyard/i)))return {kind:'card',zone:'graveyard',types:[m[1].toLowerCase()],own:m[2].toLowerCase()==='your',.../with mana value X or less/i.test(text)?{manaValue:choices.x||0}:{},max:1};
 if(text.includes('\n')&&!/target (?:noncreature )?spell|target instant or sorcery spell/i.test(text)){
  const clauses=text.split(/\n+/),targeted=clauses.filter(clause=>effectTargetSpec(clause,choices));
  if(targeted.length>1){const groups=targeted.map((text,i)=>({text,label:'Mode '+(i+1)+' target'}));return {kind:'mixed',groups,repeated:true,min:groups.length,max:groups.length};}
 }
 if((m=text.match(/deals (\d+) damage divided as you choose among one or two targets\./i)))return {kind:'mixed',types:['creature','planeswalker','battle'],zone:'battlefield',divided:true,min:1,max:2,total:Number(m[1])};
 if(/Choose any target, then choose another target for each time this spell was kicked\./i.test(text))return {kind:'mixed',types:['creature','planeswalker','battle'],zone:'battlefield',min:1+(choices.kicks||0),max:1+(choices.kicks||0)};
 if(/damage to each of up to X targets\./i.test(text))return {kind:'mixed',types:['creature','planeswalker','battle'],zone:'battlefield',optional:true,max:choices.x||0};
 if(/damage to any target\. Target player draws X cards\./i.test(text)){const groups=[{text:'any target',label:'Damage target'},{text:'target player',label:'Player who draws'}];return {kind:'mixed',groups,repeated:true,min:2,max:2};}
 if(/target card that's an instant or sorcery from your graveyard/i.test(text))return {kind:'card',zone:'graveyard',own:true,types:['instant','sorcery'],max:1};
 if(/^you may sacrifice another creature\. When you do, choose /i.test(text))return null;
 if(/target (?:noncreature )?spell/i.test(text)&&/Return target (?:nonland )?(?:permanent|creature)/i.test(text)){
  const groups=text.split(/\.\s+|\n/).filter(part=>/\btarget\b/i.test(part)).map(text=>({text}));return {kind:'card',groups,min:groups.length,max:groups.length};
 }
 if(/target (?:noncreature )?spell|target enchantment, instant, or sorcery spell|target instant or sorcery spell/i.test(text))return {kind:'card',zone:'stack',spell:true,types:/target enchantment, instant, or sorcery spell/i.test(text)?['enchantment','instant','sorcery']:/target instant or sorcery spell/i.test(text)?['instant','sorcery']:undefined,exclude:/target noncreature spell/i.test(text)?'noncreature':undefined,own:/spell you control/i.test(text),manaValue:text.match(/spell with mana value (\d+) or less/i)?.[1]!==undefined?Number(text.match(/spell with mana value (\d+) or less/i)[1]):undefined,max:1};
 if(/target creature you control[^]*target creature you don't control/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],groups:['own','opponent'],min:2,max:2};
 if(/another target creature or land you control/i.test(text))return {kind:'card',zone:'battlefield',types:['creature','land'],own:true,other:true,max:1};
 if(/target creature with flying/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],keyword:'flying',max:1};
 if(/up to four target cards from your graveyard/i.test(text))return {kind:'card',zone:'graveyard',own:true,multiGrave:true,optional:true,max:4};
 if(/for each opponent, tap up to one target creature that player controls/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],opponent:true,perOpponent:true,optional:true,max:3};
 if((m=text.match(/up to (one|two|three|\d+) target cards? from a single graveyard/i)))return {kind:'card',zone:'graveyard',optional:true,max:({one:1,two:2,three:3}[m[1]]||Number(m[1])),sameGraveyard:true};
 if((m=text.match(/(another )?target (Cat|Equipment|legendary creature)( you control)?/i)))return {kind:'card',zone:'battlefield',types:[m[2].toLowerCase()==='equipment'?'artifact':'creature'],subtype:/^(?:Cat|Equipment)$/i.test(m[2])?m[2]:undefined,legendary:/legendary/i.test(m[2]),other:!!m[1],own:!!m[3],optional:/up to one target/i.test(text),max:1};
 if(/damage divided as you choose among any number of targets/i.test(text))return {kind:'mixed',types:['creature','planeswalker','battle'],zone:'battlefield',optional:true,divided:true,max:100};
 if((m=text.match(/target permanent card with mana value (\d+) or less from your graveyard/i)))return {kind:'card',zone:'graveyard',own:true,permanent:true,manaValue:Number(m[1]),max:1};
 if(/target attacking creature with lesser power/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],attacking:true,lesserPower:true,max:1};
 if(/target (attacking or blocking|attacking|blocking) creature/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],combat:/attacking or blocking/i.test(text)?'either':/target blocking/i.test(text)?'blocking':'attacking',own:/target attacking creature you control/i.test(text),max:1};
 if(/target player or planeswalker/i.test(text))return {kind:'mixed',types:['planeswalker'],zone:'battlefield',max:1};
 if(/any target/i.test(text))return {kind:'mixed',types:['creature','planeswalker','battle'],zone:'battlefield',max:1};
 if(/target (?:opponent|player)(?:'s graveyard)?/i.test(text))return {kind:'player',opponent:/target opponent/i.test(text)};
 if((m=text.match(/target (artifact )?card from (your|a) graveyard/i)))return {kind:'card',zone:'graveyard',type:m[1]?'Artifact':null,own:m[2]==='your'};
 if(/target Human you control/i.test(text))return {kind:'card',zone:'battlefield',types:['creature'],subtype:'Human',own:true,max:1};
 if((m=text.match(/target (nontoken |noncreature |nonland |nonbasic )?(creature|planeswalker|artifact|enchantment|land|permanent)(?:,? (?:or )?(creature|planeswalker|artifact|enchantment|land))?(?:,? or (land))?( you (?:don't )?control| an opponent controls| defending player controls| that player controls)?/i)))return {kind:'card',zone:'battlefield',types:[m[2],m[3],m[4]].filter(Boolean),exclude:m[1]?.trim(),own:m[5]===' you control',opponent:/don't|opponent/.test(m[5]||''),defender:/defending|that player/.test(m[5]||''),optional:/up to (?:one|three) target/i.test(text),max:/up to three target/i.test(text)?3:1};
 return null;
}
export function effectTargetOptions(g,entry){
 const spec=effectTargetSpec(entry.text,{x:entry.castX,kicks:entry.card?.castKicks});if(!spec)return [];const owner=entry.owner,source=entry.source||entry.card,event=entry.combatTrigger?.event;
 if(spec.groups?.some(group=>typeof group==='object')){const options=new Map();for(const [group,{text}] of spec.groups.entries())for(const option of effectTargetOptions(g,{...entry,text})){const prior=options.get(option.key);options.set(option.key,{...option,groups:[...(prior?.groups||[]),group]});}return [...options.values()];}
 if(spec.kind==='player')return g.players.flatMap((p,seat)=>p.eliminated||spec.opponent&&seat===owner?[]:[{key:'player:'+seat,label:p.name,kind:'player',owner:seat}]);
 const candidates=spec.zone==='battlefield'?fieldCards(g):spec.zone==='stack'?g.stack.filter(e=>e.card).map(e=>({card:e.card,owner:e.owner,x:e.castX||0})):g.players.flatMap((p,seat)=>p.zones[spec.zone].map(card=>({card,owner:seat})));
 const cards=candidates.filter(({card,owner:controller,x})=>{
  const type=(card.layout==='split'&&spec.zone==='graveyard'?card.type_line:cardFace(card).type_line)||'';
  if(spec.spell&&card.instance===source.instance)return false;
  if(spec.permanent&&/\b(?:Instant|Sorcery)\b/.test(type)||spec.manaValue!==undefined&&manaValue(card,{x,onStack:spec.zone==='stack'})>spec.manaValue)return false;
  if(spec.combat&&(!g.combat||g.step<5||g.step>8||!(spec.combat!=='blocking'&&g.combat.attackers.some(a=>a.id===card.instance)||spec.combat!=='attacking'&&g.combat.blocks.some(b=>b.blocker===card.instance))))return false;
  if(spec.attacking&&!g.combat?.attackers.some(a=>a.id===card.instance))return false;
  if(spec.keyword&&!keywordSet(g,controller,card).has(spec.keyword))return false;
  if(spec.lesserPower){const found=findCard(g,source.instance),live=found?.zone==='battlefield'&&(found.card.battlefieldId||null)===(source.battlefieldId||null),power=live?combatStats(g,found.owner,found.card)?.power:source.lastKnownPower;if(!(combatStats(g,controller,card)?.power<power))return false;}
  if(spec.subtype&&!new RegExp('\\b'+spec.subtype+'\\b').test(type))return false;
  if(spec.legendary&&!/\bLegendary\b/.test(type)||spec.other&&card.instance===source.instance)return false;
  if(spec.own&&controller!==owner||spec.opponent&&controller===owner||spec.defender&&controller!==(event?.defender??event?.target?.owner))return false;
  if(spec.type&&!type.includes(spec.type)||spec.types&&!spec.types.includes('permanent')&&!spec.types.some(t=>new RegExp('\\b'+t+'\\b','i').test(type)))return false;
  if(spec.exclude==='noncreature'&&isCreature(card)||spec.exclude==='nonland'&&/\bLand\b/.test(type)||spec.exclude==='nonbasic'&&/\bBasic\b/.test(type))return false;
  if(spec.exclude==='nontoken'&&card.token)return false;
  return spec.zone!=='battlefield'||!keywordSet(g,controller,card).has('shroud')&&(controller===owner||!keywordSet(g,controller,card).has('hexproof'))&&!protectedFrom(g,controller,card,source);
 }).map(({card,owner:controller})=>({key:'card:'+card.instance,label:g.players[controller].name+' · '+(card.faceDown?'Face-down creature':card.name),kind:'card',id:card.instance,owner:controller,zone:spec.zone,battlefieldId:card.battlefieldId||null,zoneChangeId:card.zoneChangeId||null}));
 return spec.kind==='mixed'?[...g.players.flatMap((p,owner)=>p.eliminated?[]:[{key:'player:'+owner,label:p.name,kind:'player',owner}]),...cards]:cards;
}

export function groupedTargets(spec,targets,owner){
 if(!spec?.groups)return targets;
 if(spec.optionalGroups){
  const assign=(index,used)=>{if(index===targets.length)return [];for(const group of targets[index]?.groups||[])if(!used.includes(group)){const rest=assign(index+1,[...used,group]);if(rest)return [{...targets[index],group},...rest];}return null;};
  const result=assign(0,[]);if(!result)throw Error('Choose at most one legal target for each type.');return result;
 }
 if(spec.repeated){if(targets.length!==spec.groups.length||targets.some((target,i)=>!target?.groups?.includes(i)))throw Error('Choose a legal target for each instruction.');return targets.map((target,group)=>({...target,group}));}
 const ordered=spec.groups.map((group,i)=>targets.find(target=>typeof group==='object'?target.groups?.includes(i):group==='own'?target.owner===owner:target.owner!==owner));
 if(targets.length!==spec.groups.length||ordered.some(t=>!t)||new Set(ordered.map(t=>t.key)).size!==ordered.length)throw Error(spec.groups.every(g=>typeof g==='string')?'Choose one creature you control and one creature you do not control.':'Choose one legal target for each required group.');
 return ordered.map((target,group)=>({...target,group}));
}
