import {cardFace} from './card-state.mjs';
const amounts={an:1,one:1,two:2,three:3,four:4,five:5};
export function extraLandsInText(text,{temporary=false}={}){
 const match=(text||'').match(temporary?/(?:^|\n)You may play (an|one|two|three|four|five|\d+) additional lands? this turn\b/i:/(?:^|\n)You may play (an|one|two|three|four|five|\d+) additional lands? (?:on |during )each of your turns\b/i);
 return match?amounts[match[1].toLowerCase()]??Number(match[1]):0;
}
export function landLimit(g,owner){return 1+(g.players[owner].extraLandPlays||0)+g.players[owner].zones.battlefield.filter(c=>!c.faceDown).reduce((n,c)=>n+extraLandsInText(cardFace(c).oracle_text),0);}
export function landPlayError(g,owner){
 if(g.pendingEffect)return 'Finish the pending effect first.';
 if(g.active!==owner||![3,9].includes(g.step)||g.stack.length)return 'Play a land during your main phase with an empty stack.';
 if((g.players[owner].landsPlayed||0)>=landLimit(g,owner))return 'You have used all your land plays for this turn.';
 return '';
}
