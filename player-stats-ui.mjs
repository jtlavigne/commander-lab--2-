import {commandersFor} from './engine.mjs';

export function createPlayerStatsUI({getGame,getNetwork,getSeat,dispatch,setStatus,el}){
 const $=id=>document.getElementById(id);
 let owner=0;

 function open(seat){
  const game=getGame();
  if(getNetwork()&&seat!==getSeat()){setStatus('Each player edits their own totals.');return;}
  owner=seat;
  const player=game.players[owner],commanders=commandersFor(game,owner);
  $('stats-title').textContent=player.name;$('seat-name').value=player.name;$('life-total').value=player.life;$('poison-total').value=player.poison;
  $('command-casts').value=commanders[0]?.commandCasts??player.casts;
  $('command-casts').previousElementSibling.textContent=commanders.length>1?commanders[0].name+' casts':'Command casts';
  $('partner-casts').replaceChildren(...commanders.slice(1).map(card=>{const group=el('div'),label=el('label',card.name+' casts'),input=el('input');input.id='casts-'+card.instance;label.htmlFor=input.id;input.type='number';input.min=0;input.step=1;input.required=true;input.dataset.commander=card.instance;input.value=card.commandCasts??0;group.append(label,input);return group;}));
  $('damage-inputs').replaceChildren(...game.players.map((source,index)=>{const group=el('div'),label=el('label','Seat '+(index+1));label.htmlFor='damage-'+index;label.title=source.name;const input=el('input');input.type='number';input.min=0;input.required=true;input.id='damage-'+index;input.value=player.damage[index];group.append(label,input);return group;}));
  $('stats-dialog').showModal();
 }

 $('stats-form').onsubmit=event=>{
  event.preventDefault();
  const game=getGame(),life=Number($('life-total').value),poison=Number($('poison-total').value),casts=Number($('command-casts').value),extra=[...$('partner-casts').querySelectorAll('input')],damage=game.players.map((_,index)=>Number($('damage-'+index).value));
  if(![life,poison,...damage].every(Number.isFinite)||![casts,...extra.map(input=>Number(input.value))].every(value=>Number.isSafeInteger(value)&&value>=0))return;
  const commanders=commandersFor(game,owner);
  dispatch({type:'playerStats',owner,name:$('seat-name').value.trim(),life,poison,damage,totalCasts:casts,casts:Object.fromEntries(commanders.map((card,index)=>[card.instance,index?Number(extra.find(input=>input.dataset.commander===card.instance)?.value??card.commandCasts??0):casts]))});
  $('stats-dialog').close();
 };

 return {open};
}