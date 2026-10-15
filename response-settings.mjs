// Old sessions stored one table-wide auto/hold value. An explicit player
// preference takes precedence; seats without one retain the old behavior.
export function responseModeFor(game,owner){
 return game.players[owner]?.responseMode??(game.responseMode==='hold'?'prompt':'auto');
}

export const RESPONSE_MODES={prompt:'Prompt',auto:'Auto','pass-all':'Pass all'};
export const validResponseMode=mode=>Object.hasOwn(RESPONSE_MODES,mode);
// Availability can be expensive and can depend on hidden cards. Pass all
// deliberately ignores it; mandatory resolution choices are gated separately.
export function wantsResponse(game,owner,available){
 const mode=responseModeFor(game,owner);
 return mode==='prompt'||mode==='auto'&&available();
}
