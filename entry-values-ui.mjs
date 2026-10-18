import {el} from './ui-dom.mjs';
import {cardFace} from './card-state.mjs';
import {findCard} from './engine.mjs';
import {pendingEntryChoice} from './entry-effects.mjs';
import {createEntryOrderControl} from './entry-choice-ui.mjs';

// The renderer owns only the prompt and deferral state. Values are validated
// and committed by the same command path for local and network games.
export function createEntryValuesUI({getGame, getSeat, getNetwork, selectSeat, dispatch}) {
 const dialog = document.getElementById('entry-dialog');
 const fields = document.getElementById('entry-fields');
 const later = document.getElementById('entry-later');
 const deferred = new Set();
 // Commands replace card objects. A zone/entry identity keeps "Later" stable
 // across snapshots without suppressing a future entry of the same card.
 const entryKey = card => card.instance + ':' + (card.battlefieldId || card.zoneChangeId || '');

 function entryForPrompt(id) {
  const game = getGame();
  const staged = pendingEntryChoice(game);
  if (staged?.kind === 'values' && staged.card.instance === id) {
   return {...staged, preEntry: true};
  }
  const found = findCard(game, id);
  return found?.zone === 'battlefield' && found.card.entryChoices?.length ? found : null;
 }

 function open(id) {
  const found = entryForPrompt(id);
  if (!found) return;
  const {card} = found;
  const face = cardFace(card);
  fields.replaceChildren();
  dialog.dataset.card = id;
  document.getElementById('entry-title').textContent = face.name || card.name;
  document.getElementById('entry-oracle').textContent = face.oracle_text || '';
  later.disabled = !!found.preEntry;
  dialog.querySelector('.entry-decision-order')?.remove();
  if (found.preEntry) {
   const order = createEntryOrderControl(getGame(), dispatch, () => dialog.close());
   if (order) fields.before(order);
  }
  for (const choice of card.entryChoices) {
   const group = el('div');
   const label = el('label', choice.label);
   const input = el('input');
   input.id = 'entry-' + fields.children.length;
   label.htmlFor = input.id;
   input.dataset.choice = choice.key;
   input.type = 'number';
   input.step = 1;
   input.min = choice.min;
   input.max = 999999;
   input.required = true;
   input.value = choice.suggested;
   group.append(label, input);
   fields.append(group);
  }
  dialog.showModal();
  fields.querySelector('input')?.select();
 }

 // Refresh after accepted commands or dialog dismissal. Other focused views
 // retain priority; a mandatory pre-entry decision cannot be deferred.
 function refresh() {
  const game = getGame();
  const network = getNetwork();
  const staged = pendingEntryChoice(game);
  const canChoose = staged?.kind === 'values' && (!network || network.seat === staged.owner);
  if (canChoose && getSeat() !== staged.owner) {
   selectSeat(staged.owner);
   return;
  }
  const pending = game.players.flatMap(player => player.zones.battlefield)
   .filter(card => card.entryChoices?.length);
  const live = new Set(pending.map(entryKey));
  for (const key of deferred) if (!live.has(key)) deferred.delete(key);
  if (dialog.open) {
   if (entryForPrompt(dialog.dataset.card)) return;
   dialog.close();
  }
  if (document.querySelector('dialog[open]')) return;
  if (canChoose) {
   open(staged.card.instance);
   return;
  }
  const card = pending.find(card => !deferred.has(entryKey(card)) &&
   (!network || findCard(game, card.instance)?.owner === getSeat()));
  if (card) open(card.instance);
 }

 function defer() {
  if (entryForPrompt(dialog.dataset.card)?.preEntry) return;
  const found = findCard(getGame(), dialog.dataset.card);
  if (found) deferred.add(entryKey(found.card));
  dialog.close();
 }

 document.getElementById('entry-form').onsubmit = event => {
  event.preventDefault();
  const found = entryForPrompt(dialog.dataset.card);
  if (!found) return;
  const values = Object.fromEntries([...fields.querySelectorAll('input')]
   .map(input => [input.dataset.choice, Number(input.value)]));
  dispatch({type: 'entryValues', id: found.card.instance, values});
 };
 later.onclick = defer;
 dialog.oncancel = event => {event.preventDefault(); defer();};
 return {open, refresh};
}
