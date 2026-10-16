// Templates are off-table card definitions, never physical game pieces.
// Keyword actions use these same definitions for import discovery and creation.
export const KEYWORD_TOKENS={investigate:{name:'Clue',type_line:'Token Artifact — Clue',colors:[],oracle_text:'{2}, Sacrifice this artifact: Draw a card.'}};
const fields=['id','name','type_line','oracle_text','power','toughness','loyalty','colors','color_identity','keywords','image_uris','localImages','artworkVersion','artworkError','layout','card_faces'];
export const isCopyPlaceholder=card=>card.type_line==='Token'&&/\bcopy of\b/i.test(card.oracle_text||'');
const clean=text=>String(text||'').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').trim().toLowerCase();
export function tokenTemplate(card){return {oracle_text:'',...Object.fromEntries(fields.filter(key=>card[key]!==undefined).map(key=>[key,structuredClone(card[key])])),tokenTemplate:true};}
export function matchingToken(catalog,definition){
 if(definition.localImages||definition.image_uris)return null; // Copies retain the original permanent's art.
 const candidates=(catalog||[]).filter(t=>clean(t.name)===clean(definition.name)&&
  ['power','toughness'].every(k=>(String(t[k]??'')===String(definition[k]??'')||['X','*'].includes(t[k])&&/^\d+$/.test(definition[k])))&&
  [...(t.colors||[])].sort().join('')===[...(definition.colors||[])].sort().join('')&&
  /Creature/i.test(t.type_line)===/Creature/i.test(definition.type_line));
 const abilities=text=>clean(text).replace(/\([^]*?\)/g,'').replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
 const exact=candidates.find(t=>abilities(t.oracle_text)===abilities(definition.oracle_text));
 // Named noncreature tokens have a unique definition; creature variants need
 // matching abilities so a flying Warrior never supplies a ground Warrior.
 return exact||candidates.find(t=>!definition.power)||null;
}
export function namedToken(text){
 const m=String(text).replace(/[“”]/g,'"').match(/^Create ([^,]+), an? (legendary )?(colorless|white|blue|black|red|green) (?:(\w+) )?(artifact|enchantment) token with "([^]*?)"(?: and "([^]*?)")?\.?$/i);
 if(!m)return null;
 return {name:m[1],type_line:'Token '+(m[2]?'Legendary ':'')+m[5][0].toUpperCase()+m[5].slice(1)+(m[4]?' \u2014 '+m[4]:''),colors:m[3].toLowerCase()==='colorless'?[]:[{white:'W',blue:'U',black:'B',red:'R',green:'G'}[m[3].toLowerCase()]],oracle_text:[m[6],m[7]].filter(Boolean).map(t=>/[.!?]$/.test(t)?t:t+'.').join('\n')};
}
export function discoverTokens(cards){
 const ids=new Set(),definitions=[];
 for(const card of cards){
  for(const part of card.all_parts||[])if(part.component==='token'&&part.id)ids.add(part.id);
  for(const face of [card,...(card.card_faces||[])]){
   const text=String(face.oracle_text||'');
   if(/\binvestigate\b/i.test(text))definitions.push(structuredClone(KEYWORD_TOKENS.investigate));
   for(const line of text.split('\n')){const at=line.search(/Create /i);if(at>=0){const token=namedToken(line.slice(at));if(token)definitions.push(token);}}
   for(const m of text.matchAll(/\b(?:create|creates) (?:a|an|one|two|three|four|five|six|X|\d+|that many) (\d+|\*)\/(\d+|\*) ((?:white|blue|black|red|green|colorless)(?: and (?:white|blue|black|red|green))?) ([a-z -]+?) creature tokens?(?: named ([^.\n]+))?(?: with ([^.\n]+))?/gi)){
    const artifact=/\bartifact\b/i.test(m[4]),name=m[4].replace(/\bartifact\b/i,'').trim();
    definitions.push({name:m[5]||name,type_line:'Token '+(artifact?'Artifact ':'')+'Creature — '+name,power:m[1],toughness:m[2],colors:(m[3].match(/white|blue|black|red|green/gi)||[]).map(c=>({white:'W',blue:'U',black:'B',red:'R',green:'G'}[c.toLowerCase()])),oracle_text:m[6]||''});
   }
  }
 }
 return {ids:[...ids],definitions:[...new Map(definitions.map(t=>[JSON.stringify(t),t])).values()]};
}
export function tokenSearch(definition){
 const quote=s=>'"'+String(s).replace(/["\\]/g,'')+'"';
 return 't:token !'+quote(definition.name)+(definition.power!==undefined?' pow:'+definition.power+' tou:'+definition.toughness+' c='+((definition.colors||[]).join('')||'c'):'');
}
