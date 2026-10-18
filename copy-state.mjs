// Layer-one values are separate from the physical card's printed definition.
// Removing an effect or changing zones therefore restores the original card.
export const COPY_FIELDS=['id','name','mana_cost','cmc','type_line','oracle_text','power','toughness','loyalty','defense','colors','color_indicator','color_identity','keywords','image_uris','localImages','artworkVersion','layout'];

export function copiedCharacteristics(card){
 const values=card.copyEffects?.at(-1)?.values;
 if(!values)return card;
 // Undefined printed fields must not leak from the underlying permanent (for
 // example a planeswalker's loyalty when it copies an ordinary creature).
 return {...card,...Object.fromEntries([...COPY_FIELDS,'card_faces'].map(key=>[key,values[key]])),face:0};
}

export function expireCopies(card){
 if(!card.copyEffects)return;
 card.copyEffects=card.copyEffects.filter(effect=>!effect.untilEndOfTurn);
 if(!card.copyEffects.length)delete card.copyEffects;
}

export function validateCopyEffects(effects,fail){
 if(effects===undefined)return;
 if(!Array.isArray(effects)||!effects.length||effects.length>50)fail();
 for(const effect of effects){
  const values=effect?.values;
  if(!effect||typeof effect.untilEndOfTurn!=='boolean'||Object.keys(effect).some(key=>!['values','untilEndOfTurn'].includes(key))||!values||Array.isArray(values)||typeof values!=='object')fail();
  if(Object.keys(values).some(key=>!COPY_FIELDS.includes(key))||['name','type_line','oracle_text'].some(key=>typeof values[key]!=='string'||values[key].length>20000))fail();
  for(const key of ['power','toughness','loyalty','defense','mana_cost','id','layout'])if(values[key]!==undefined&&(typeof values[key]!=='string'||values[key].length>1000))fail();
  if(values.cmc!==undefined&&(!Number.isFinite(values.cmc)||values.cmc<0||values.cmc>999999))fail();
  for(const key of ['colors','color_identity','color_indicator','keywords'])if(values[key]!==undefined&&(!Array.isArray(values[key])||values[key].length>200||values[key].some(value=>typeof value!=='string'||value.length>200)))fail();
 }
}
