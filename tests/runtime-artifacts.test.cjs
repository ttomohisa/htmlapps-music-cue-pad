const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
for (const artifact of ['dist/index.html', 'music-cue-pad.html', 'dist/index.self-extract.html']) {
  test(`all app/exported-player interaction regressions pass on ${artifact}`, t => {
    let sourcePath = path.join(root, artifact);
    if (artifact.endsWith('.self-extract.html')) {
      const loader = fs.readFileSync(sourcePath, 'utf8');
      const match = loader.match(/<script id="self-extract-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/);
      assert.ok(match, 'self-extract contains an embedded gzip payload');
      const restored = gunzipSync(Buffer.from(match[1].trim(), 'base64'));
      assert.ok(restored.equals(fs.readFileSync(path.join(root, 'dist/index.html'))), 'decompressed payload must match readable HTML byte-for-byte');
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'music-cue-runtime-test-'));
      t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
      sourcePath = path.join(directory, 'restored.html');
      fs.writeFileSync(sourcePath, restored);
    }
    // Node's runner marks child tests; do not let that suppress this independent test run.
    const env = { ...process.env, MUSIC_CUE_SOURCE: sourcePath };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/next-cue.test.cjs', 'tests/exported-player.test.cjs', 'tests/cue-reorder.test.cjs'], {
      cwd: root, env, encoding: 'utf8', timeout: 120000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# tests [1-9][0-9]*/, 'child runner must execute tests, not silently skip them');
  });
}
