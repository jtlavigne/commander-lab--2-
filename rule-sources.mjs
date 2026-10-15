// Emblems supply rules from the command zone, but are never permanents, targets,
// deck cards or things that can leave with their originating planeswalker.
export const emblemSources=g=>g.players.flatMap((p,owner)=>(p.emblems||[]).map(card=>({card,owner})));
export const ruleSources=g=>[...g.players.flatMap((p,owner)=>p.zones.battlefield.map(card=>({card,owner}))),...emblemSources(g)];
export function createEmblem(g,owner,source,text){
 const emblem={instance:crypto.randomUUID(),name:(source?.name||'Planeswalker')+' emblem',type_line:'Emblem',oracle_text:text,emblem:true};
 (g.players[owner].emblems??=[]).push(emblem);return emblem;
}
