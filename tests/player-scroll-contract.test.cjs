// CSS contracts, not a browser-layout simulation. Removing the short-player
// cap, scrolling, shared clearance or Live landscape override must fail here.
// Native Help hit-testing, wheel/Tab reachability and Undo bounds still need QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(style, 'the app has an inline stylesheet');

function readRules(css, media = []) {
  const rules = [];
  for (let cursor = 0; cursor < css.length;) {
    const open = css.indexOf('{', cursor);
    if (open < 0) break;
    const selector = css.slice(cursor, open).trim();
    let end = open + 1;
    let depth = 1;
    while (depth && end < css.length) {
      if (css[end] === '{') depth++;
      if (css[end] === '}') depth--;
      end++;
    }
    assert.equal(depth, 0, 'CSS block is balanced');
    const body = css.slice(open + 1, end - 1);
    if (selector.startsWith('@media')) rules.push(...readRules(body, [...media, selector.slice(6).trim()]));
    else if (!selector.startsWith('@')) rules.push({ selectors: selector.split(',').map(value => value.trim()), media, body });
    cursor = end;
  }
  return rules;
}

const rules = readRules(style.replace(/\/\*[\s\S]*?\*\//g, ''));
function mediaMatches(query, width, height) {
  return query.split(/\s+and\s+/).every(condition => {
    const maximum = condition.match(/^\(max-(width|height):\s*(\d+)px\)$/);
    if (maximum) return (maximum[1] === 'width' ? width : height) <= Number(maximum[2]);
    if (condition === '(orientation: landscape)') return width > height;
    if (condition === '(orientation: portrait)') return height >= width;
    return false; // No reduced-motion preference is needed for these contracts.
  });
}

// Read declarations in source order for one exact selector, including grouped
// selectors. Root inheritance and the body's own Live override are separate.
function declarations(selector, width, height) {
  const result = {};
  for (const rule of rules) {
    if (!rule.selectors.includes(selector) || !rule.media.every(query => mediaMatches(query, width, height))) continue;
    for (const declaration of rule.body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon > 0) result[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
  }
  return result;
}

for (const [width, height] of [[393, 252], [320, 252], [393, 480], [620, 480]]) {
  for (const live of [false, true]) {
    test(`CSS contract: ${width}x${height} ${live ? 'Live' : 'edit'} player has a scrollable cap shared by page/Undo clearance`, () => {
      const player = declarations('.player-bar', width, height);
      const root = declarations(':root', width, height);
      const body = live ? declarations('body.live-mode', width, height) : {};
      assert.equal(player['max-height'], 'var(--player-height)', 'the fixed player must use the shared height cap');
      assert.equal(player['overflow-y'], 'auto', 'lower controls must remain scrollable');
      assert.equal(player['overscroll-behavior'], 'contain', 'inner wheel scrolling must not chain to the page');
      assert.equal(body['--player-height'] || root['--player-height'], live && width > height ? 'min(134px, 50dvh)' : '50dvh');
      assert.match(declarations('body.player-visible .main', width, height)['padding-bottom'], /var\(--player-height\)/);
      assert.match(declarations('.app-toast', width, height).bottom, /var\(--player-height\)/);
    });
  }
}

for (const [width, height, live, clearance] of [
  [393, 852, false, '278px'], [393, 852, true, '278px'],
  [621, 252, false, '126px'], [1360, 900, false, '108px'],
  [844, 390, true, '134px']
]) {
  test(`CSS contract: ${width}x${height} ${live ? 'Live' : 'edit'} layout retains its existing player sizing`, () => {
    const player = declarations('.player-bar', width, height);
    const root = declarations(':root', width, height);
    const body = live ? declarations('body.live-mode', width, height) : {};
    assert.equal(player['max-height'], undefined);
    assert.equal(player['overflow-y'], undefined);
    assert.equal(body['--player-height'] || root['--player-height'], clearance);
  });
}

test('CSS contract: short Live landscape keeps the existing compact transport arrangement', () => {
  const inner = declarations('body.live-mode .player-inner', 393, 252);
  const actions = declarations('body.live-mode .player-actions', 393, 252);
  assert.equal(inner['min-height'], '96px');
  assert.equal(inner['grid-template-columns'], 'minmax(0,1fr) auto');
  assert.equal(actions.display, 'flex');
  assert.equal(actions['grid-column'], '2');
  assert.equal(actions['grid-row'], '1');
});
