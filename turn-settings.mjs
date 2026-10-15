// Player preferences override the legacy table-wide option. Resolve the active
// seat at the time of the action, including after a turn handoff.
export function automaticFor(game,owner,fallback=false){
 return game.players[owner]?.automatic??fallback;
}
