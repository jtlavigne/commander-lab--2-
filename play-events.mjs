import {cardFace} from './card-state.mjs';

// Public announcements survive an immediately auto-resolved stack and travel
// with shared state. Draft selections and private cards never enter this log.
export function recordPlay(g,{kind='cast',owner,source,text='',targets=[],stackId}){
 const face=cardFace(source),fields=['instance','id','oracle_id','name','type_line','mana_cost','oracle_text','power','toughness','colors','image_uris','face'];
 const card=Object.fromEntries(fields.filter(key=>face[key]!==undefined).map(key=>[key,structuredClone(face[key])]));
 const event={id:crypto.randomUUID(),kind,owner,card,text,targets:structuredClone(targets),...(stackId?{stackId}:{})};
 g.playEvents=[...(g.playEvents||[]),event].slice(-8);return event;
}
export function validatePlayEvents(g,fail){
 if(g.playEvents===undefined)return;
 if(!Array.isArray(g.playEvents)||g.playEvents.length>8)fail();
 for(const event of g.playEvents)if(!event||typeof event.id!=='string'||!['cast','copy','ability','reveal'].includes(event.kind)||!Number.isInteger(event.owner)||!g.players[event.owner]||!event.card||typeof event.card.instance!=='string'||typeof event.card.name!=='string'||typeof event.text!=='string'||event.text.length>20000||!Array.isArray(event.targets)||event.targets.length>100||event.targets.some(t=>!t||!['card','player'].includes(t.kind)||!Number.isInteger(t.owner)||!g.players[t.owner]||typeof t.key!=='string'||t.kind==='card'&&typeof t.id!=='string'))fail();
}
