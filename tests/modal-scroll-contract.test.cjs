// CSS contracts only: native outside-wheel, dismissal, focus and content
// reachability checks are still required in the browser.
// Removing either modal-only ancestor lock must fail this contract.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(style, 'the app has an inline stylesheet');
const css = style.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

for (const ancestor of ['html', 'body']) {
  test(`CSS contract: ${ancestor} locks page scrolling only while a native modal is open`, () => {
    const selector = `${ancestor}:has(dialog:modal)`;
    const rule = rules.find(([, selectors]) =>
      selectors.split(',').map(value => value.trim()).includes(selector));
    assert.ok(rule, `missing modal-only ${selector} ancestor rule`);
    assert.match(rule[2], /(?:^|;)\s*overflow\s*:\s*hidden\s*(?:;|$)/,
      `${ancestor} must block background page scrolling`);
    assert.match(rule[2], /(?:^|;)\s*overscroll-behavior\s*:\s*none\s*(?:;|$)/,
      `${ancestor} must suppress background overscroll`);
  });
}
