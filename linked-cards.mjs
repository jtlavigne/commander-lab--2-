// Links use zone-change identity, so moving an exiled card and returning it
// cannot keep a previous permanent's characteristic-setting effect active.
export function refreshLinkedCards(g){
 for(const player of g.players)for(const card of player.zones.battlefield){
  card.exileLinks=(card.exileLinks||[]).filter(link=>g.players.some(p=>p.zones.exile.some(c=>c.instance===link.id&&c.zoneChangeId===link.zoneChangeId)));
  if(/power and toughness are each equal to the number of cards exiled with it\./i.test(card.oracle_text||''))card.linkedExileCount=card.exileLinks.length;
  if(!card.exileLinks.length)delete card.exileLinks;
  delete card.imprintProfile;
  if(card.faceDown||!card.imprintLink)continue;
  const owner=g.players.findIndex(p=>p.zones.exile.some(c=>c.instance===card.imprintLink.id&&c.zoneChangeId===card.imprintLink.zoneChangeId)),linked=g.players[owner]?.zones.exile.find(c=>c.instance===card.imprintLink.id);
  const face=linked&&{...linked,...linked.card_faces?.[linked.face||0]},own={...card,...card.card_faces?.[card.face||0]};
  if(!face||!/\bCreature\b/.test(face.type_line||'')||!/has the power, toughness, and creature types of the last creature card exiled with it/i.test(own.oracle_text||''))continue;
  const types=[...new Set([...(face.type_line.split('—')[1]||'').trim().split(/\s+/).filter(Boolean),'Shapeshifter'])];
  let power=face.power,toughness=face.toughness;
  if(/power is equal to the number of creatures you control\./i.test(face.oracle_text||''))power=String(g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bCreature\b/.test(c.type_line||'')).length);
  if(/power and toughness are each equal to the number of lands you control/i.test(face.oracle_text||''))power=toughness=String(g.players[owner].zones.battlefield.filter(c=>!c.faceDown&&/\bLand\b/.test(c.type_line||'')).length);
  card.imprintProfile={power,toughness,type_line:own.type_line.split('—')[0].trim()+' — '+types.join(' ')};
 }
}
