// Preserve the order of explicit gains/losses within the turn without changing
// printed abilities. Full continuous-effect dependency ordering remains separate.
export function grantKeywords(card,keywords){const combined=[...(card.temporaryKeywords||[]),...keywords];card.temporaryKeywords=combined.filter((k,i)=>/^toxic \d+$/i.test(k)||combined.indexOf(k)===i);card.lostKeywords=(card.lostKeywords||[]).filter(k=>!keywords.includes(k)&&!(k==='toxic'&&keywords.some(v=>/^toxic \d+$/i.test(v))));if(!card.lostKeywords.length)delete card.lostKeywords;}
export function loseKeywords(card,keywords){card.lostKeywords=[...new Set([...(card.lostKeywords||[]),...keywords])];card.temporaryKeywords=(card.temporaryKeywords||[]).filter(k=>!keywords.includes(k));}
