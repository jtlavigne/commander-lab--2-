import {runKeywordAction,KEYWORD_ACTION_OPERATIONS} from './keyword-actions.mjs';
import {runPermanentCopy,COPY_OPERATIONS} from './permanent-copy.mjs';
import {runPolymorphStep,POLYMORPH_OPERATIONS} from './polymorph.mjs';
import {runLibraryStep,LIBRARY_OPERATIONS} from './library-effects.mjs';
import {runReanimationStep,REANIMATION_OPERATIONS} from './reanimation.mjs';
import {runSecretStep,SECRET_OPERATIONS} from './secret-choices.mjs';
import {runPermissionStep,PERMISSION_OPERATIONS} from './permission-effects.mjs';
import {runTemporalStep,TEMPORAL_OPERATIONS} from './temporal-effects.mjs';

export const EFFECT_UNHANDLED=0;
export const EFFECT_CONTINUE=1;
export const EFFECT_STOP=2;

// Route by operation instead of trying every family for every instruction.
// STOP means a choice or nested continuation owns the remaining program; the
// caller must not execute it again. Some legacy families use boolean results,
// which are adapted here without changing their public APIs or saved programs.
let handlers;
function effectHandlers(){
 if(handlers)return handlers;
 // Build lazily: engine/effect modules import each other, so their operation
 // lists are only available once module initialization has finished.
 const families=[
  [POLYMORPH_OPERATIONS,runPolymorphStep],
  [LIBRARY_OPERATIONS,runLibraryStep],
  [COPY_OPERATIONS,runPermanentCopy,result=>result?EFFECT_STOP:EFFECT_UNHANDLED],
  [KEYWORD_ACTION_OPERATIONS,runKeywordAction],
  [REANIMATION_OPERATIONS,runReanimationStep],
  [SECRET_OPERATIONS,runSecretStep],
  [PERMISSION_OPERATIONS,runPermissionStep],
  [TEMPORAL_OPERATIONS,runTemporalStep,result=>result==='paused'?EFFECT_STOP:result?EFFECT_CONTINUE:EFFECT_UNHANDLED]
 ];
 const result=new Map();
 for(const [operations,run,normalize=value=>value] of families){
  for(const operation of operations){
   if(result.has(operation))throw Error('Duplicate effect operation: '+operation);
   result.set(operation,{run,normalize});
  }
 }
 handlers=result;
 return handlers;
}
export function runEffectFamily(game,context,step,remaining,resume){
 const handler=effectHandlers().get(step.op);
 if(!handler)return EFFECT_UNHANDLED;
 return handler.normalize(handler.run(game,context,step,remaining,resume));
}
