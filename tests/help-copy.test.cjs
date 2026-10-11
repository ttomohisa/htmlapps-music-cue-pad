const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');

const rejected = [
  "ヘルプ・キュー編集・確認画面を開いている間は、背後のページはスクロールしません。閉じると元の位置から操作を続けられます。",
  "The page behind Help, the cue editor or a confirmation stays still while it is open. Close the dialog to continue from the same page position.",
  "横幅が狭く高さも低い画面では、下部プレイヤー内をスクロールしてすべての操作を使えます。Tabキーでも各操作へ移動できます。",
  "On narrow, short screens, scroll inside the bottom player or use Tab to reach every playback control.",
  "キーボードで書き出した後は、別の操作へ移動していなければ書き出しボタンからTabキーで操作を続けられます。",
  "After a keyboard-started export, continue with Tab from the export button unless you have moved to another control."
];

test('help contains user guidance rather than implementation or layout audit prose', () => {
  const root = path.join(__dirname, '..');
  const files = ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html',
    ...fs.readdirSync(root).filter(name => name.endsWith('.html'))];
  for (const file of files) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    let html = fs.readFileSync(filename, 'utf8');
    const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
    if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
    for (const copy of rejected) assert.ok(!html.includes(copy), `${file}: remove internal-facing help copy: ${copy}`);
  }
});
