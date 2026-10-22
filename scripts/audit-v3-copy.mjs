import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const previous = read('src/content/stories/reunion-v2.json');
const current = read('src/content/stories/reunion-v3.json');
const background = read('src/content/story-background.json');
const textLength = text => [...text].length;
const hanLength = text => [...text.matchAll(/\p{Script=Han}/gu)].length;
const proseFields = new Set(['title', 'lead', 'subtitles', 'guidedSubtitles', 'fullTiming', 'guidedTiming']);
const structural = node => Object.fromEntries(Object.entries(node).filter(([key]) => !proseFields.has(key)));

assert.equal(current.definitionVersion, 3);
assert.equal(current.subtitleTimebase, 'full-target-ms');
assert.equal(current.nodes.length, 36);
assert.deepEqual(current.nodes.map(node => node.id), previous.nodes.map(node => node.id));
assert.deepEqual(current.endings.map(ending => ending.id), previous.endings.map(ending => ending.id));
for (const node of current.nodes) {
  const old = previous.nodes.find(item => item.id === node.id);
  assert.deepEqual(structural(node), structural(old), `${node.id}: v2 graph, actors, poses, assets and interaction geometry must remain unchanged`);
  assert.equal(node.fullTiming.minDurationMs, node.id === 'craft' ? 0 : node.fullTiming.targetMs, `${node.id}: full prelude must finish; prepared craft confirms immediately`);
  assert.equal(node.guidedTiming.minDurationMs, node.id === 'craft' ? 0 : node.guidedTiming.targetMs, `${node.id}: guided prelude must finish; prepared craft confirms immediately`);
  if (node.kind === 'terminal') {
    assert.equal(node.subtitles.length, 0);
    assert.equal(node.guidedSubtitles.length, 0);
    continue;
  }
  for (const [mode, cues] of [['full', node.subtitles], ['guided', node.guidedSubtitles]]) {
    assert.ok(cues.length > 0, `${node.id}/${mode}: authored dialogue required`);
    assert.equal(cues[0].startMs, 0, `${node.id}/${mode}: no opening dead time`);
    assert.equal(cues.at(-1).endMs, node.fullTiming.targetMs, `${node.id}/${mode}: no trailing dead time`);
    let end = 0;
    for (const cue of cues) {
      assert.ok(cue.startMs >= end && cue.startMs - end <= 500, `${node.id}/${mode}: subtitle overlap or empty gap`);
      assert.ok(cue.endMs > cue.startMs && cue.endMs <= node.fullTiming.targetMs, `${node.id}/${mode}: subtitle bounds`);
      assert.ok(['narrator', ...node.actors].includes(cue.speaker), `${node.id}/${mode}: offstage speaker`);
      assert.equal(cue.contentKind, 'original-adaptation');
      assert.ok(textLength(cue.text) <= 60, `${node.id}/${mode}: split long subtitle into a natural short cue`);
      const seconds = (cue.endMs - cue.startMs) / 1000 * (mode === 'full' ? 1 : node.guidedTiming.targetMs / node.fullTiming.targetMs);
      assert.ok(textLength(cue.text) / seconds < 6, `${node.id}/${mode}: cue is too fast`);
      end = cue.endMs;
    }
  }
  assert.notDeepEqual(node.guidedSubtitles.map(cue => cue.text), node.subtitles.map(cue => cue.text), `${node.id}: guided mode must use an independent excerpt`);
}

const rows = [];
for (const approach of ['call-first', 'split-first']) {
  for (const ending of current.endings) {
    const nodes = [];
    let id = current.startNodeId;
    while (id) {
      assert.ok(!nodes.some(node => node.id === id), 'cyclic route');
      const node = current.nodes.find(item => item.id === id);
      assert.ok(node, `missing ${id}`);
      nodes.push(node);
      id = node.next ? node.next.default ?? node.next[node.id === 'ending-choice' ? ending.id : approach] : null;
    }
    assert.equal(nodes.length, 21);
    assert.equal(nodes.at(-1).id, 'completed');
    assert.ok(nodes.some(node => node.id === ending.epilogueNodeId));
    const full = nodes.flatMap(node => node.subtitles).map(cue => cue.text).join('');
    const guided = nodes.flatMap(node => node.guidedSubtitles).map(cue => cue.text).join('');
    const fullSeconds = nodes.reduce((total, node) => total + node.fullTiming.targetMs / 1000, 0);
    const guidedSeconds = nodes.reduce((total, node) => total + node.guidedTiming.targetMs / 1000, 0);
    assert.ok(textLength(full) >= 3500 && textLength(full) <= 5000, `${approach}/${ending.id}: full copy outside agreed range`);
    assert.ok(fullSeconds >= 960 && fullSeconds <= 1020, 'nominal full dialogue should leave room for manipulation and showcase');
    assert.ok(guidedSeconds >= 300 && guidedSeconds <= 420, 'independent guided excerpt should run 5–7 minutes');
    rows.push({ approach, ending: ending.id, nodes: nodes.length, textChars: textLength(full), hanChars: hanLength(full), fullSeconds, guidedTextChars: textLength(guided), guidedSeconds });
  }
}
assert.deepEqual(background.sections.map(section => section.id), ['family', 'captivity', 'journey', 'guardian']);
assert.deepEqual(background.sourceIds, ['C5']);
const backgroundText = background.intro + background.sections.map(section => section.text).join('');
assert.ok(textLength(backgroundText) >= 600 && textLength(backgroundText) <= 900, 'background should be 600–900 characters');
console.table(rows);
console.log(`Background: ${textLength(backgroundText)} text characters; ${hanLength(backgroundText)} Han characters. ${textLength(backgroundText + background.adaptationNote)} including adaptation note.`);
console.log('PASS: 10 complete routes; unchanged v2 structural fields; independent guided excerpts; subtitle rhythm and background checked.');
console.log('Timing is nominal authored dialogue only; user manipulation, showcase, pause and reading time require separate browser measurement.');
