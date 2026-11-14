import test from 'node:test';
import assert from 'node:assert/strict';
import {activityEmoji,villagerSpeech} from '../src/village-speech.js';
test('nearby activity chatter describes basket, axe and wall work without word labels',()=>{
  assert.equal(activityEmoji('Rest','twining weave basket'),'🧺');
  assert.equal(activityEmoji('Rest','hand axe'),'🪓');assert.equal(activityEmoji('Rest','drystone wall'),'🪨');
  assert.equal(activityEmoji('Clear hut site'),'🪓');assert.equal(activityEmoji('Clear herb site'),'🪓');
  assert.equal(activityEmoji('Camp circle'),'👋');assert.equal(activityEmoji('Waiting'),null);
});
test('speech is brief and respects a long cooldown instead of becoming a permanent activity tag',()=>{
  const p={};assert.equal(villagerSpeech(p,'🧺',0,1,true),null);
  assert.equal(villagerSpeech(p,'🧺',15,1,true),'🧺');assert.equal(villagerSpeech(p,'🧺',17,1,true),'🧺');
  assert.equal(villagerSpeech(p,'🧺',18,1,true),null);assert.equal(villagerSpeech(p,'🧺',40,1,true),null);
  assert.equal(villagerSpeech(p,'🧺',50,1,true),'🧺');
});
test('urgent needs, leaving company, pausing or a changed activity interrupt chatter immediately',()=>{
  const p={};villagerSpeech(p,'🧺',0,1,true);assert.equal(villagerSpeech(p,'🧺',15,1,true),'🧺');
  assert.equal(villagerSpeech(p,'🧺',16,1,false),null);assert.equal(villagerSpeech(p,'🧺',17,1,true),null);
  assert.equal(villagerSpeech(p,'🪓',18,1,true),null);assert.equal(villagerSpeech(p,null,50,1,true),null);
});
test('speech staggering is deterministic and uses only visual state',()=>{
  const a={},b={};for(let t=0;t<100;t++)assert.equal(villagerSpeech(a,'👋',t,5,true),villagerSpeech(b,'👋',t,5,true));
  assert.deepEqual(a,b);
});
