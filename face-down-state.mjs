// Public characteristics are independent of the printed card beneath a manifest.
export function publicManifest(card){
 const result={name:'Face-down creature',type_line:'Creature',oracle_text:'',mana_cost:'',cmc:0,colors:[],power:'2',toughness:'2',face:0,faceDown:true,manifested:true};
 for(const key of ['instance','ownerSeat','battlefieldId','zoneChangeId','tapped','tablePosition','counters','summoningSick','markedDamage','deathtouchDamage','temporaryStats','temporaryKeywords','lostKeywords','attachedTo','attachedBattlefieldId','goadedBy','commander','commandSlot'])if(card[key]!==undefined)result[key]=structuredClone(card[key]);
 return result;
}
