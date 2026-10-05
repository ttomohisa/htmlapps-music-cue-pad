const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'music-cue-release-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.cpSync(root, directory, {
    recursive: true,
    filter: source => !['.git', '.cache', 'dist', 'node_modules'].includes(path.relative(root, source).split(path.sep)[0])
  });
  // Nested repository checks must not recursively rerun this build-test suite.
  fs.writeFileSync(path.join(directory, 'tests/release-parity.test.cjs'), '// Build regression tests run in the outer test process.\n');
  return directory;
}

function powershell(directory, script, args = []) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
    cwd: directory, env, encoding: 'utf8', timeout: 120000
  });
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
}

function build(directory, args = []) {
  const result = powershell(directory, 'build-standalone.ps1', args);
  assert.equal(result.status, 0, result.output);
}

test('default build refreshes the tracked release byte-for-byte from readable output', t => {
  const directory = fixture(t);
  fs.writeFileSync(path.join(directory, 'music-cue-pad.html'), 'stale tracked release');
  build(directory);
  assert.ok(fs.readFileSync(path.join(directory, 'music-cue-pad.html')).equals(fs.readFileSync(path.join(directory, 'dist/index.html'))), 'default build must synchronize the tracked release');
  assert.ok(fs.existsSync(path.join(directory, 'dist/index.self-extract.html')));
});

test('custom OutputPath builds both variants without changing the tracked release', t => {
  const directory = fixture(t);
  const release = path.join(directory, 'music-cue-pad.html');
  const original = fs.readFileSync(release);
  build(directory, ['-OutputPath', 'custom/preview.html']);
  assert.ok(fs.readFileSync(release).equals(original), 'custom output must preserve the tracked release');
  assert.ok(fs.existsSync(path.join(directory, 'custom/preview.html')));
  assert.ok(fs.existsSync(path.join(directory, 'custom/preview.self-extract.html')));
  assert.equal(fs.existsSync(path.join(directory, 'dist/index.html')), false);
});

for (const target of ['music-cue-pad.html', 'src/index.template.html']) {
  test(`repository check rejects drift in ${target} before the default build can repair it`, t => {
    const directory = fixture(t);
    build(directory);
    // Seed a matching baseline even when testing the old builder without release synchronization.
    fs.copyFileSync(path.join(directory, 'dist/index.html'), path.join(directory, 'music-cue-pad.html'));
    const changed = path.join(directory, target);
    const original = fs.readFileSync(changed, 'utf8');
    fs.writeFileSync(changed, original + '\n<script>window.releaseParityProbe = true;</script>\n');
    const releaseBefore = fs.readFileSync(path.join(directory, 'music-cue-pad.html'));
    const distBefore = fs.readFileSync(path.join(directory, 'dist/index.html'));
    const result = powershell(directory, 'scripts/check-repository.ps1');
    assert.notEqual(result.status, 0, 'stale release must fail the repository check');
    assert.match(result.output, /Tracked release is stale/);
    assert.ok(fs.readFileSync(path.join(directory, 'music-cue-pad.html')).equals(releaseBefore), 'check must not repair the tracked release');
    assert.ok(fs.readFileSync(path.join(directory, 'dist/index.html')).equals(distBefore), 'default build must not run after drift');
  });
}

function sampleRelease({ timestamp = '2026-10-01T00:00:00.0000000Z', config = { name: "Cue's pad", volume: 1 }, assets = { dependencies: {} }, runtime = 'window.ready = true;', spaced = false } = {}) {
  const json = value => JSON.stringify(value, null, spaced ? 1 : undefined).replace(spaced ? /'/g : /$^/g, '\\u0027');
  return '<script>\n' +
    `const APP_CONFIG = ${json(config)};\n` +
    `const BUILD_MANIFEST = ${json({ generatedAtUtc: timestamp, schemaVersion: 2, app: { version: '1.0.0' }, dependencies: [] })};\n` +
    `const assetBundle = ${json(assets)};\n${runtime}\n</script>\n`;
}

function compareReleases(t, expected, actual) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'music-cue-parity-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const expectedPath = path.join(directory, 'expected.html');
  const actualPath = path.join(directory, 'actual.html');
  fs.writeFileSync(expectedPath, expected);
  fs.writeFileSync(actualPath, actual);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-release-parity.cjs'), expectedPath, actualPath], { encoding: 'utf8' });
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
}

test('parity accepts build timestamps, equivalent JSON escaping/spacing, and CRLF', t => {
  const result = compareReleases(t, sampleRelease(), sampleRelease({ timestamp: '2026-10-05T12:00:00.0000000Z', spaced: true }).replace(/\n/g, '\r\n'));
  assert.equal(result.status, 0, result.output);
});

for (const [name, options] of [
  ['runtime code', { runtime: 'window.ready = false;' }],
  ['application config', { config: { name: "Cue's pad", volume: 0 } }],
  ['embedded assets', { assets: { dependencies: { changed: { base64: 'YQ==' } } } }],
  ['invalid build timestamp', { timestamp: 'invalid' }]
]) {
  test(`parity rejects changed ${name}`, t => {
    const result = compareReleases(t, sampleRelease(), sampleRelease(options));
    assert.notEqual(result.status, 0);
    assert.match(result.output, /Tracked release is stale/);
  });
}
