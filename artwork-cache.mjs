// Artwork and manually adjusted loyalty layouts belong to the local client.
// Keep them outside game snapshots so undo and network updates can reuse them.
export function createArtworkCache() {
 const artwork = new Map();
 const layouts = new Map();
 const keyFor = card => card.id || card.name;

 function rememberCard(card) {
  if (card.localImages) {
   artwork.set(keyFor(card), {
    localImages: card.localImages,
    artworkVersion: card.artworkVersion,
    artworkError: card.artworkError
   });
  }
 }

 function remember(cards) {
  for (const card of cards) {
   rememberCard(card);
   if (card.loyaltyLayout) layouts.set(keyFor(card), card.loyaltyLayout);
  }
 }

 function restore(cards) {
  for (const card of cards) {
   const art = artwork.get(keyFor(card));
   if (art) Object.assign(card, art);
   const layout = layouts.get(keyFor(card));
   if (layout && !card.loyaltyLayout) card.loyaltyLayout = layout;
  }
 }

 return {rememberCard, remember, restore, get: card => artwork.get(keyFor(card))};
}
