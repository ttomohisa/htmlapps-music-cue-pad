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

// These source contracts are paired with native Chromium geometry checks in PR CI.
function mobileHelpMedia(width) {
  const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
  const marker = new RegExp('@media\\s*\\(max-width:\\s*' + width + 'px\\)\\s*\\{').exec(css);
  assert.ok(marker, 'existing smartphone media query');
  const start = marker.index + marker[0].length;
  let depth = 1, end = start;
  while (depth && end < css.length) { if (css[end] === '{') depth++; if (css[end] === '}') depth--; end++; }
  return css.slice(start, end - 1);
}
test('informational footer hides at 620px without hiding functional controls', () => {
  assert.match(mobileHelpMedia(620), /(?:^|[}])\s*footer\s*\{[^}]*display:\s*none/);
});
test('existing build information is unique and the final Help body item, not page chrome', () => {
  const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || '';
  const help = source.match(/<dialog\b[^>]*id="helpDialog"[^>]*>([\s\S]*?)<\/dialog>/)?.[1] || '';
  assert.doesNotMatch(main, /data-i18n="buildInfo"|id="buildInfo"/);
  assert.doesNotMatch(source.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0], /id="buildInfo"/);
  assert.match(help, /<details class="build-details">\s*<summary data-i18n="buildInfo">[\s\S]*?<\/details>\s*(?:<!-- APP:HELP:END -->\s*)?<\/div>\s*$/);
  for (const id of ['buildVersion', 'builtAt', 'dependencyCount']) assert.equal(source.split(`id="${id}"`).length, 2, id);
});

test('Help keyboard descendant clicks stay open and genuine backdrop clicks dismiss', () => {
  const handler = source.match(/helpDialog\.addEventListener\(["']click["'], (?:\(event\)|event) => \{([\s\S]*?)\n      \}\);/)[1];
  const dialog = {open:true, getBoundingClientRect:()=>({left:100,top:100,right:740,bottom:700}),close(){this.open=false;}};
  const click = new Function('helpDialog', 'event', handler);
  click(dialog, {target:{},clientX:0,clientY:0}); assert.equal(dialog.open,true);
  click(dialog, {target:dialog,clientX:0,clientY:0}); assert.equal(dialog.open,false);
});

test('Live Mode still hides build details after relocation', () => assert.match(source, /body\.live-mode \.build-details[^{}]*\{[^}]*display:\s*none/));
