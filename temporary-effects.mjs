// Preserve the order of explicit gains/losses within the turn without changing
// printed abilities. Full continuous-effect dependency ordering remains separate.
export function grantKeywords(card,keywords){card.temporaryKeywords=[...new Set([...(card.temporaryKeywords||[]),...keywords])];card.lostKeywords=(card.lostKeywords||[]).filter(k=>!keywords.includes(k));if(!card.lostKeywords.length)delete card.lostKeywords;}
export function loseKeywords(card,keywords){card.lostKeywords=[...new Set([...(card.lostKeywords||[]),...keywords])];card.temporaryKeywords=(card.temporaryKeywords||[]).filter(k=>!keywords.includes(k));}
