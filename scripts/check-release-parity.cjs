const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');

function releaseContent(html) {
  const data = {};
  // Git/platform line endings are immaterial; all other HTML/CSS/JS text stays exact.
  let runtime = html.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (const name of ['APP_CONFIG', 'BUILD_MANIFEST', 'assetBundle']) {
    const pattern = new RegExp('^([ \\t]*const ' + name + ' = )([\\s\\S]*?);(?=\\n|$)', 'gm');
    let count = 0;
    runtime = runtime.replace(pattern, (_, declaration, json) => {
      count += 1;
      // JSON equivalence must not conceal an unsafe inline-script terminator.
      if (/[<>&]/.test(json)) throw new Error(`${name} contains unescaped HTML characters`);
      const value = JSON.parse(json);
      if (name === 'BUILD_MANIFEST') {
        if (typeof value.generatedAtUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.generatedAtUtc) || Number.isNaN(Date.parse(value.generatedAtUtc))) {
          throw new Error('BUILD_MANIFEST has no valid UTC build timestamp');
        }
        // This is the only generated data value allowed to differ between builds.
        delete value.generatedAtUtc;
      }
      data[name] = value;
      return declaration + '__VERIFIED_BUILD_JSON__;';
    });
    if (count !== 1) throw new Error(`Expected exactly one generated ${name} declaration`);
  }
  return { runtime, data };
}

try {
  const [expectedPath, releasePath] = process.argv.slice(2);
  if (!expectedPath || !releasePath) throw new Error('Usage: node scripts/check-release-parity.cjs <fresh HTML> <tracked release>');
  const expected = releaseContent(fs.readFileSync(expectedPath, 'utf8'));
  const actual = releaseContent(fs.readFileSync(releasePath, 'utf8'));
  if (actual.runtime !== expected.runtime || !isDeepStrictEqual(actual.data, expected.data)) {
    throw new Error('HTML, runtime, config, or embedded asset content differs from a fresh build');
  }
  console.log('[OK] Tracked release matches a fresh build (excluding build timestamp and JSON formatting).');
} catch (error) {
  console.error(`Tracked release is stale: ${error.message}. Run build-standalone.ps1 and commit music-cue-pad.html.`);
  process.exitCode = 1;
}
