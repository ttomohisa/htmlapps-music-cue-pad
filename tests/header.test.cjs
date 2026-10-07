// Execute the real localization and click handlers with a synthetic DOM.
// This checks text, accessible names and preference behavior, not browser layout.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
const config = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));

function runtimeFunction(name) {
  const start = source.search(new RegExp('^      function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `runtime function ${name} exists`);
  return source.slice(start, source.indexOf('\n      }', start) + 8);
}

function harness(storage = new Map(), browserLanguage = 'en-US') {
  const elements = [];
  for (const match of source.slice(0, source.indexOf('<script>')).matchAll(/<[a-z][\w-]*\b([^>]*?)>/g)) {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const dataset = Object.fromEntries(Object.entries(attributes).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    elements.push({ attributes, dataset, textContent: '', listeners: {},
      get title() { return this.attributes.title || ''; }, set title(value) { this.attributes.title = value; },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      click() { this.listeners.click?.(); }
    });
  }
  const $ = selector => elements.find(el => el.attributes.id === selector.slice(1));
  const document = { documentElement: {}, querySelectorAll: selector => elements.filter(el => selector.slice(1, -1) in el.attributes) };
  const state = { cues: [], masterVolume: 0.8 };
  const context = vm.createContext({ document, $, state, APP_CONFIG: config, navigator: { language: browserLanguage },
    storageKeys: { language: `${config.slug}:language` }, readStorage: key => storage.get(key), writeStorage: (key, value) => storage.set(key, value),
    renderCues() {}, renderPlayer() {}, updateCueCount() {}, refreshImportStatus() {}, updateCueEditDialog() {}, setMasterVolume() {}, renderStorageStatus() {}, renderLiveModeUi() {}, AppToast: { dismiss() {} }
  });
  const translations = source.match(/      const translations = \{[\s\S]*?\n      \};/);
  const initialization = source.match(/      let language = readStorage\(storageKeys.language\) \|\| detectLanguage\(\);/);
  const clickHandler = source.match(/      \$\('#languageButton'\)\.addEventListener\('click', \(\) => \{[\s\S]*?\n      \}\);/);
  assert.ok(translations && initialization && clickHandler, 'test the real translation, initial language and click handler');
  vm.runInContext([translations[0], runtimeFunction('detectLanguage'), runtimeFunction('translate'), initialization[0], runtimeFunction('applyLanguage'), clickHandler[0], 'applyLanguage();'].join('\n'), context);
  return { $, document, state, elements, storage };
}

for (const [language, visible, target, help, privacy] of [
  ['ja', 'EN', '英語に切り替え', '使い方と注意事項', '完全ローカル処理'],
  ['en', 'JA', 'Switch to Japanese', 'How to use & notes', 'Fully local processing']
]) {
  test(`${language}: language button names its target with EN/JA`, () => {
    const h = harness(new Map(), language);
    assert.equal(h.document.documentElement.lang, language);
    assert.equal(h.$('#languageButton').textContent, visible);
    assert.equal(h.$('#languageButton').attributes['aria-label'], target);
  });
  test(`${language}: language tooltip uses the current UI language`, () => {
    assert.equal(harness(new Map(), language).$('#languageButton').title, target);
  });
  test(`${language}: Help accessible name, tooltip and local-processing copy are localized`, () => {
    const h = harness(new Map(), language);
    assert.equal(h.$('#helpButton').attributes['aria-label'], help);
    assert.equal(h.$('#helpButton').title, help);
    assert.equal(h.elements.find(el => el.dataset.i18n === 'localBadge').textContent, privacy);
  });
}

test('repeated language clicks persist the choice and reload restores it without altering cue state', () => {
  const storage = new Map();
  const h = harness(storage, 'ja-JP');
  const before = JSON.stringify(h.state);
  for (const [language, label] of [['en', 'JA'], ['ja', 'EN'], ['en', 'JA']]) {
    h.$('#languageButton').click();
    assert.equal(h.document.documentElement.lang, language);
    assert.equal(h.$('#languageButton').textContent, label);
    assert.equal(storage.get(`${config.slug}:language`), language);
  }
  assert.equal(JSON.stringify(h.state), before);
  assert.equal(harness(storage, 'ja-JP').document.documentElement.lang, 'en');
  assert.equal(storage.size, 1);
});
