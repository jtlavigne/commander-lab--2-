import {el} from './ui-dom.mjs';
import {entryChoiceOptions,pendingEntryChoice} from './entry-effects.mjs';

// One owner may have several independent decisions during a simultaneous
// entry. Selecting one changes focus only; it pays no cost and moves no card.
export function createEntryOrderControl(game,dispatch,after){
 const pending=game.pendingEffect;if(pending?.kind!=='entry-choice')return null;
 const options=entryChoiceOptions(game,pending.entries),selected=pendingEntryChoice(game,pending);
 if(options.length<2)return null;
 const label=el('label','Decide next','entry-decision-order'),select=el('select');select.dataset.entryOrder='true';
 for(const [index,choice] of options.entries()){
  const option=el('option',(choice.index+1)+'. '+choice.card.name+' — '+({copy:'Copy a permanent',values:'Starting values',condition:'Tapped condition',life:'Life payment'}[choice.kind]));option.value=String(index);option.dataset.entryCard=choice.card.instance;option.dataset.entryKind=choice.kind;option.selected=choice.index===selected.index&&choice.kind===selected.kind;select.append(option);
 }
 select.onchange=()=>{const choice=options[Number(select.value)];if(choice)dispatch({type:'entrySelect',id:choice.card.instance,kind:choice.kind},{after});};
 label.append(select);return label;
}
