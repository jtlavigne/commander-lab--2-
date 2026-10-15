// Offline, illustrative pieces for trying the interface; these are not legal deck lists.
import {newGame,note} from './engine.mjs';
const kits=[
 {name:'Green / Tokens',commander:'Rhys the Redeemed',color:'green',land:'Forest',cards:['Llanowar Elves','Cultivate','Elvish Mystic','Beast Within','Avenger of Zendikar','Rampant Growth']},
 {name:'Blue / Spells',commander:'Talrand, Sky Summoner',color:'blue',land:'Island',cards:['Ponder','Counterspell','Preordain','Opt','Brainstorm','Swan Song']},
 {name:'Red / Dragons',commander:'Lathliss, Dragon Queen',color:'red',land:'Mountain',cards:['Dragon Tempest','Abrade','Chaos Warp','Thrill of Possibility','Dragonlord’s Servant','Mind Stone']},
 {name:'Black / Reanimator',commander:'Meren of Clan Nel Toth',color:'black',land:'Swamp',cards:['Sakura-Tribe Elder','Victimize','Reanimate','Eternal Witness','Viscera Seer','Cultivate']}
];
export function practiceGame(playerCount=4){
 const game=newGame(playerCount);
 kits.slice(0,playerCount).forEach((kit,owner)=>{
  const piece=(name,extra={})=>({instance:crypto.randomUUID(),name,type_line:name===kit.land?'Basic Land':name==='Sol Ring'?'Artifact':'Practice card',oracle_text:name==='Sol Ring'?'{T}: Add {C}{C}.':'Offline practice piece. Import a deck to load official card data and artwork.',...(name==='Sol Ring'?{mana_cost:'{1}'}:{}),previewColor:kit.color,tapped:false,counters:{},face:0,practice:true,...extra});
  const player=game.players[owner];player.name=kit.name;
  player.zones.command=[piece(kit.commander,{commander:true,commandSlot:0,commandCasts:0,previewColor:'gold',type_line:'Legendary Creature'})];
  player.zones.hand=[piece(kit.land),piece('Sol Ring',{previewColor:'artifact'}),...kit.cards.slice(0,5).map(name=>piece(name))];
  player.zones.battlefield=[piece(kit.land),piece(kit.land),piece(kit.land,{tapped:true}),piece(kit.cards[0]),piece('Sol Ring',{previewColor:'artifact'})];
  player.zones.library=Array.from({length:87},(_,i)=>piece(i%3===0?kit.land:kit.cards[i%kit.cards.length]));
 });
 game.step=3;note(game,'Offline practice table loaded. Illustrative cards, no deck legality or effects enforced.');return game;
}
