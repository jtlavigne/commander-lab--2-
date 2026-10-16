import {activeRuleParagraphs,keywordDeclarationText} from './ability-effects.mjs';
import {keywordSet} from './creature-rules.mjs';

// Display only the familiar keyword set requested for card footers. This list
// controls presentation; the rules engine can still handle other mechanics.
const ICONS={
 flying:'M3 19Q3 8 21 3L16 11L9 13L17 13L12 18L6 18Z',
 'first strike':'M5 20L18 3L20 3L20 6L8 21ZM4 14L11 20',
 'double strike':'M2 18L12 3L14 3L14 6L5 20ZM10 18L20 3L22 3L22 6L13 20',
 deathtouch:'M5 13C0 0 24 0 19 13L17 15V21H7V15ZM8 9V11M16 9V11M10 17V21M14 17V21',
 lifelink:'M12 21L3 12C-2 4 8 0 12 7C16 0 26 4 21 12ZM12 9V16M9 12H15',
 defender:'M4 21V10L2 8V3H6V6H10V3H14V6H18V3H22V8L20 10V21ZM4 11H20',
 reach:'M6 3Q22 12 6 21L14 12ZM2 12H22M18 8L22 12L18 16',
 hexproof:'M12 2L21 6V12Q20 18 12 22Q4 18 3 12V6ZM8 10L12 16L16 10Z',
 trample:'M3 5L8 8L16 6L20 3L21 15L17 21H7L3 16ZM7 12L9 14M17 12L15 14',
 haste:'M15 2L4 14H11L9 22L21 9H14Z',
 vigilance:'M1 12Q12 -2 23 12Q12 26 1 12ZM15 12A3 3 0 1 0 9 12A3 3 0 1 0 15 12',
 indestructible:'M12 2L21 6V12Q20 18 12 22Q4 18 3 12V6ZM7 12L11 16L17 8',
 menace:'M2 4L12 7L22 4L20 19L12 22L4 19ZM6 11L10 13M18 11L14 13M9 17H15',
 protection:'M12 2L21 6V12Q20 18 12 22Q4 18 3 12V6Z',
 flash:'M14 2L3 13H10L8 22L21 8H14ZM2 4H6M18 20H22',
 prowess:'M6 21L2 12L5 10L8 14V5Q10 2 11 5V11V3Q13 0 14 3V11V5Q16 2 17 5V12V8Q20 5 20 8V17L17 21Z',
 ward:'M12 2V5M12 19V22M2 12H5M19 12H22M5 5L7 7M17 17L19 19M5 19L7 17M17 7L19 5M17 12A5 5 0 1 0 7 12A5 5 0 1 0 17 12',
 changeling:'M3 7L8 2L13 7L8 12ZM11 16L16 11L21 16L16 21ZM3 17H7M17 7H21',
 affinity:'M8 7A4 4 0 1 0 8 15H12M16 7A4 4 0 1 1 16 15H12M8 11H16',
};
const KEYWORDS=Object.keys(ICONS);
const PARAMETERIZED=new Set(['ward','protection','affinity']);
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const label=name=>name.charAt(0).toUpperCase()+name.slice(1);

// Match ability declarations, not mentions in targets, reminder text or a
// provider's "other creatures have flying" clause. Card-wide Scryfall keywords
// may describe both faces, so metadata alone is never enough to display one.
function readKeywords(text,vocabulary){
 const clean=keywordDeclarationText(text,vocabulary);if(clean===null)return [];
 return vocabulary.filter(name=>{
  const tail=PARAMETERIZED.has(name)?'(?=$|[ :{0-9])':'(?=$|,| and |:)';
  return new RegExp('(?:^|, | and )'+escape(name)+tail,'i').test(clean)&&! /\b(?:as long as|unless)\b/i.test(clean);
 });
}

export function cardKeywordBadges(g,owner,card,{onBoard=false}={}){
 // A concealed hand must never reveal its printed keywords (including a
 // manifested card returned to hand). Public manifest grants are board-only.
 if(card.faceDown&&(!onBoard||!card.manifested))return [];
 const read=text=>readKeywords(text,KEYWORDS);
 const names=onBoard?keywordSet(g,owner,card,{keywords:KEYWORDS,read}):new Set(activeRuleParagraphs(card).flatMap(({text})=>read(text)));
 for(const lost of card.lostKeywords||[])if(onBoard)names.delete(lost);
 return [...names].filter(name=>Object.hasOwn(ICONS,name)).sort().map(name=>({name,label:label(name),path:ICONS[name]}));
}

// ---- Rendering: decorative badges preserve card drag/tap behavior ----
export function keywordStrip(badges){
 if(!badges.length)return null;
 const row=document.createElement('span');row.className='card-keywords';row.setAttribute('role','group');row.setAttribute('aria-label','Keywords: '+badges.map(b=>b.label).join(', '));
 for(const badge of badges.slice(0,4)){
  const item=document.createElement('span');item.className='card-keyword';item.dataset.keyword=badge.name;item.title=badge.label;item.setAttribute('role','img');item.setAttribute('aria-label',badge.label);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',badge.path);svg.append(path);item.append(svg);row.append(item);
 }
 if(badges.length>4){const more=document.createElement('span');more.className='card-keyword card-keyword-more';more.textContent='+'+(badges.length-4);more.title=badges.slice(4).map(b=>b.label).join(', ');more.setAttribute('aria-label','More keywords: '+more.title);row.append(more);}
 return row;
}
