import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkCache} from '../artwork-cache.mjs';

test('artwork survives serialized snapshots without replacing current gameplay or layout', () => {
 const cache = createArtworkCache();
 const original = {
  id: 'printing', name: 'Walker', instance: 'old',
  localImages: {front: 'data:image/png;base64,art'}, artworkVersion: 2,
  loyaltyLayout: {0: [{x: 1, y: 2}]}, counters: {loyalty: 3}
 };
 cache.remember([original]);
 const snapshot = JSON.parse(JSON.stringify(original, (key, value) => key === 'localImages' ? undefined : value));
 snapshot.counters.loyalty = 7;
 snapshot.loyaltyLayout = {0: [{x: 3, y: 4}]};
 cache.restore([snapshot]);
 assert.deepEqual(snapshot.localImages, original.localImages);
 assert.equal(snapshot.artworkVersion, 2);
 assert.equal(snapshot.counters.loyalty, 7);
 assert.deepEqual(snapshot.loyaltyLayout, {0: [{x: 3, y: 4}]});
});

test('another instance reuses artwork and missing layout, but another printing stays separate', () => {
 const cache = createArtworkCache();
 const card = {id: 'printing-a', name: 'Walker', localImages: {front: 'cached'}, loyaltyLayout: {0: [{x: 1, y: 2}]}};
 cache.remember([card]);
 const same = {id: 'printing-a', name: 'Walker', instance: 'new'};
 const other = {id: 'printing-b', name: 'Walker'};
 cache.restore([same, other]);
 assert.deepEqual(same.localImages, card.localImages);
 assert.deepEqual(same.loyaltyLayout, card.loyaltyLayout);
 assert.deepEqual(other, {id: 'printing-b', name: 'Walker'});
});

test('name-only artwork can be refreshed and caches remain client-local', () => {
 const cache = createArtworkCache();
 cache.rememberCard({name: 'Custom token', localImages: {front: 'old'}, artworkError: 'old failure'});
 cache.rememberCard({name: 'Custom token'});
 assert.equal(cache.get({name: 'Custom token'}).localImages.front, 'old');
 cache.rememberCard({name: 'Custom token', localImages: {front: 'new'}, artworkVersion: 3});
 const snapshot = {name: 'Custom token', artworkError: 'old failure'};
 cache.restore([snapshot]);
 assert.equal(snapshot.localImages.front, 'new');
 assert.equal(snapshot.artworkError, undefined);
 assert.equal(createArtworkCache().get(snapshot), undefined);
});
