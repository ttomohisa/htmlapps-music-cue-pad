'use strict';
// End-to-end browser test for the actual HTML exported from the single-file app.
// Source and exported-player unit tests cannot test responsive layout or native media events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

function silentWav(seconds) {
  const samples = Math.round(8000 * seconds);
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}


async function assertMainCueRowAlignment(page, label, expectedInRow) {
  // A previous cue render can briefly leave stale detached cards while
  // importing or transitioning playback; compare boxes only after the
  // current list is visibly laid out.
  await page.waitForFunction(expected => {
    const cards = [...document.querySelectorAll('#cueGrid .cue-card')];
    return cards.length >= expected && cards.every(card => card.isConnected && card.getBoundingClientRect().height > 50);
  }, expectedInRow, { timeout: 8000 });
  const cards = await page.evaluate(() => [...document.querySelectorAll('#cueGrid .cue-card')].map(el => {
    const r = el.getBoundingClientRect();
    const play = el.querySelector('.cue-play').getBoundingClientRect();
    const tools = el.querySelector('.cue-tools').getBoundingClientRect();
    const progressElement = el.querySelector('.cue-progress-track');
    const progress = progressElement.getBoundingClientRect();
    return {
      top: r.top, bottom: r.bottom, height: r.height,
      playBottom: play.bottom, toolsTop: tools.top, toolsBottom: tools.bottom,
      progressTop: progress.top, progressHeight: progress.height,
      progressVisible: getComputedStyle(progressElement).visibility !== 'hidden',
      progressClass: progressElement.className,
      cueClass: el.className,
      styleDisplay: getComputedStyle(el).display,
      gridHidden: document.getElementById('cueGrid').hidden,
      gridDisplay: getComputedStyle(document.getElementById('cueGrid')).display,
      hiddenParent: el.closest('[hidden]')?.id || '',
      bodyClass: document.body.className,
    };
  }));
  const row = cards.filter(card => Math.abs(card.top - cards[0].top) <= 1);
  assert.equal(row.length, expectedInRow, label + ': expected cards in first grid row '+JSON.stringify(cards));
  for (const card of row) {
    assert.ok(Math.abs(card.bottom - row[0].bottom) <= 1, label + ': all card bottoms align');
    assert.ok(Math.abs(card.toolsTop - row[0].toolsTop) <= 1, label + ': edit bars start at same height');
    assert.ok(Math.abs(card.toolsBottom - row[0].toolsBottom) <= 1, label + ': edit bars end at same height');
    assert.ok(Math.abs(card.playBottom - row[0].playBottom) <= 1, label + ': play button ends align');
    assert.ok(Math.abs(card.progressTop - row[0].progressTop) <= 1, label + ': progress bar positions align');
    assert.ok(Math.abs(card.progressHeight - row[0].progressHeight) <= 1, label + ': inactive progress reserves same height');
  }
  return cards;
}


async function assertScrollReachesLastContent(page, selector, label) {
  // Entering Live Mode intentionally scrolls to the cue section on the next
  // animation frame. Let that finish before testing a user's later scroll.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(120);
  const measured = await page.evaluate(selector => {
    const target = document.querySelector(selector).getBoundingClientRect();
    const transport = document.getElementById('playerBar').getBoundingClientRect();
    const main = document.querySelector('main');
    const padding = parseFloat(getComputedStyle(main).paddingBottom);
    return {
      targetBottom: target.bottom, playerTop: transport.top,
      playerHeight: transport.height, padding,
      visible: !document.getElementById('playerBar').hidden,
      scrollTop: document.scrollingElement.scrollTop
    };
  }, selector);
  assert.equal(measured.visible, true, label + ': transport visible');
  assert.ok(measured.playerHeight > 120, label + ': transport measurable');
  assert.ok(measured.padding >= measured.playerHeight + 24, label + ': clearance follows actual transport height ' + JSON.stringify(measured));
  assert.ok(measured.targetBottom <= measured.playerTop - 16, label + ': last content not covered by fixed player ' + JSON.stringify(measured));
}

async function main() {
  const output = path.resolve(__dirname, '..', 'test-results', 'music-export');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const language of ['ja', 'en']) {
      for (const width of [320, 360, 800, 900, 1280]) {
        const label = language + ' ' + width;
        const context = await browser.newContext({
          viewport: { width, height: width <= 360 ? 680 : 800 },
          locale: language,
          acceptDownloads: true,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const errors = [], remoteRequests = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', r => { if (/^https?:/i.test(r.url())) remoteRequests.push(r.url()); });
        try {
          await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'dist', 'index.html')).href);
          await page.locator('#audioInput:not([disabled])').waitFor();
          if (await page.locator('html').getAttribute('lang') !== language) {
            await page.locator('#languageButton').click();
          }
          const wav = silentWav(12);
          await page.locator('#audioInput').setInputFiles([
            { name: 'very-long-audio-title-for-a-test-of-the-card-layout.wav', mimeType: 'audio/wav', buffer: wav },
            { name: 'short.wav', mimeType: 'audio/wav', buffer: wav },
            { name: 'third.wav', mimeType: 'audio/wav', buffer: wav },
          ]);
          await page.waitForFunction(() => {
            const cues = [...document.querySelectorAll('.cue-card .cue-play')];
            return cues.length === 3 && cues.every(button => !button.disabled);
          });
          assert.equal(await page.locator('#exportPlayerButton').isEnabled(), true, label + ': playback export available after loading tracks');
          assert.equal(await page.locator('#exportBackupButton').isEnabled(), true, label + ': board backup available after loading tracks');

          if (language === 'ja' && width === 360) {
            // A reset disables both exports on an empty board. Adding files must
            // re-enable them without visiting the export screen or reloading.
            await page.locator('#resetButton:not([disabled])').waitFor();
            await page.locator('#resetButton').click();
            await page.locator('#appConfirmDialog').waitFor({ state:'visible' });
            await page.locator('#appConfirmOk').click();
            await page.waitForFunction(() => document.querySelectorAll('.cue-card').length === 0);
            assert.equal(await page.locator('#exportPlayerButton').isEnabled(), false, label + ': empty board disables playback export');
            assert.equal(await page.locator('#exportBackupButton').isEnabled(), false, label + ': empty board disables backup');

            // Reset finishes asynchronously after clearing the visible cue grid.
            await page.locator('#audioInput:not([disabled])').waitFor();
            await page.locator('#audioInput').setInputFiles([
              { name: 'very-long-audio-title-for-a-test-of-the-card-layout.wav', mimeType: 'audio/wav', buffer: wav },
              { name: 'short.wav', mimeType: 'audio/wav', buffer: wav },
              { name: 'third.wav', mimeType: 'audio/wav', buffer: wav },
            ]);
            await page.waitForFunction(() => {
              const cues = [...document.querySelectorAll('.cue-card .cue-play')];
              return cues.length === 3 && cues.every(button => !button.disabled);
            });
            assert.equal(await page.locator('#exportPlayerButton').isEnabled(), true, label + ': export re-enabled after reset and re-import');
            assert.equal(await page.locator('#exportBackupButton').isEnabled(), true, label + ': backup re-enabled after reset and re-import');
          }

          const drop = page.locator('#dropZone');
          assert.ok(await drop.evaluate(el => el.classList.contains('is-compact')), label + ': compact drop after import');
          assert.match(await drop.locator('.drop-title').innerText(), language === 'ja' ? /3曲を追加済み/ : /3 tracks added/, label);
          assert.equal(await page.locator('.import-panel .panel-head').isVisible(), false, label + ': redundant import heading hidden');
          const saveBackup = page.locator('#exportBackupButton'), loadBackup = page.locator('#importBackupButton');
          assert.equal(await saveBackup.innerText(), language === 'ja' ? '保存する' : 'Save backup', label + ': concise backup save label');
          assert.equal(await loadBackup.innerText(), language === 'ja' ? '読み込む' : 'Load backup', label + ': concise backup import label');
          assert.equal(await saveBackup.getAttribute('aria-label'), language === 'ja' ? 'バックアップを書き出す' : 'Export board backup', label + ': descriptive accessible label');
          if (width <= 360) {
            for (const button of [saveBackup, loadBackup]) {
              assert.ok(await button.evaluate(el => {
                const range = document.createRange();
                range.selectNodeContents(el);
                return [...range.getClientRects()].length === 1 && el.scrollWidth <= el.clientWidth + 1;
              }), label + ': one-line backup button');
            }
            assert.equal(await page.locator('.backup-note').innerText(), language === 'ja' ? '.bkcue はMusic Cue Pad用のZIPコンテナです。' : '.bkcue is a ZIP container for Music Cue Pad.', label + ': unnecessary backup sentence removed');
          }
          await drop.focus();
          assert.equal(await drop.isEnabled(), true, label + ': still a file picker');

          // Keyboard-captured shortcuts are optional; add one to exercise reserved footer height.
          await page.locator('.cue-card').first().locator('.cue-tool-button').nth(1).focus();
          await page.keyboard.press('Enter');
          await page.locator('#cueShortcutInput').focus();
          await page.keyboard.press('n');
          await page.locator('#saveCueEditButton').click();
          assert.equal(await page.locator('#cueEditDialog').isVisible(), false);

          const rowCount = width > 860 ? 3 : width > 620 ? 2 : 1;
          await assertMainCueRowAlignment(page, label + ' idle', rowCount);
          const first = page.locator('.cue-card .cue-play').first();
          await first.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.querySelector('.cue-card .cue-play')?.getAttribute('aria-pressed') === 'true');
          assert.ok(await first.locator('.cue-center').locator('svg rect').count() >= 2, label + ': play button changes to pause icon');
          const activeRow = await assertMainCueRowAlignment(page, label + ' active', rowCount);
          assert.equal(activeRow[0].progressVisible, true, label + ': active progress visible');
          if (rowCount > 1) assert.ok(activeRow.slice(1, rowCount).every(card => !card.progressVisible), label + ': inactive progress hidden without losing layout height ' + JSON.stringify(activeRow));
          await first.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.querySelector('.cue-card .cue-play')?.getAttribute('aria-pressed') === 'false');
          assert.ok(await first.locator('.cue-center').locator('svg path').count() >= 1, label + ': paused button changes to play icon');
          await assertMainCueRowAlignment(page, label + ' paused', rowCount);
          await first.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.querySelector('.cue-card .cue-play')?.getAttribute('aria-pressed') === 'true');
          await page.locator('#stopButton').focus();
          await page.keyboard.press('Enter');
          await assertMainCueRowAlignment(page, label + ' stopped', rowCount);
          // A focused cue must handle native Space, not toggle the previously
          // active cue through the document's global Space shortcut.
          const second = page.locator('.cue-card .cue-play').nth(1);
          await second.focus();
          await page.keyboard.press('Space');
          await page.waitForFunction(() => document.querySelectorAll('.cue-card .cue-play')[1]?.getAttribute('aria-pressed') === 'true');
          assert.equal(await page.locator('.cue-card .cue-play').first().getAttribute('aria-pressed'), 'false', label + ': native Space plays focused second cue');
          await second.focus();
          await page.keyboard.press('Space');
          await page.waitForFunction(() => document.querySelectorAll('.cue-card .cue-play')[1]?.getAttribute('aria-pressed') === 'false');
          await page.locator('#stopButton').click();
          if (width === 1280 && language === 'ja') {
            await page.locator('#cueGrid').screenshot({ path: path.join(output, 'main-cue-aligned-3-col.png') });
          }
          if (width <= 360) {
            await assertScrollReachesLastContent(page, '.backup-panel', label + ': editor');
            await page.locator('#enterLiveModeButton').click();
            await page.waitForFunction(() => document.body.classList.contains('live-mode'));
            await assertScrollReachesLastContent(page, '#cueGrid .cue-card:last-child', label + ': live mode');
            await page.locator('#exitLiveModeButton').focus();
            await page.keyboard.down('Enter');
            await page.waitForFunction(() => !document.body.classList.contains('live-mode'));
            await page.keyboard.up('Enter');
            await page.locator('#exportPlayerButton:not([disabled])').waitFor();
          }

          const download = page.waitForEvent('download');
          await page.locator('#exportPlayerButton').focus();
          await page.keyboard.press('Enter');
          const outFile = await download;
          assert.match(outFile.suggestedFilename(), /\.html$/, label);
          const filePath = path.join(output, 'player-' + language + '-' + width + '.html');
          await outFile.saveAs(filePath);
          const playerPage = await context.newPage();
          playerPage.on('pageerror', e => errors.push(e.message));
          playerPage.on('request', r => { if (/^https?:/i.test(r.url())) remoteRequests.push(r.url()); });
          await playerPage.goto(pathToFileURL(filePath).href);

          const expected = language === 'ja'
            ? '音源と再生設定はこのHTML内に含まれています。'
            : 'Audio and playback settings are included in this HTML file.';
          assert.equal(await playerPage.locator('.title p').innerText(), expected, label + ': new header description');
          assert.equal(await playerPage.locator('.top h2').count(), 0, label + ': no extra hero');
          assert.equal(await playerPage.locator('.grid .cue').count(), 3, label);
          const boxes = await playerPage.locator('.grid .cue').evaluateAll(cards =>
            cards.map(c => ({card: c.getBoundingClientRect().toJSON(), remaining: c.querySelector('.remaining').getBoundingClientRect().toJSON()})));
          for (const b of boxes) {
            assert.ok(b.card.left >= 0 && b.card.right <= width + 1, label + ': card fits');
            assert.ok(b.remaining.height >= 40, label + ': remaining background has adequate height');
          }
          assert.ok(Math.max(...boxes.map(b => b.card.height)) - Math.min(...boxes.map(b => b.card.height)) <= 2, label + ': all cue cards same height');
          assert.ok(Math.max(...boxes.map(b => b.remaining.height)) - Math.min(...boxes.map(b => b.remaining.height)) <= 2, label + ': remaining panels same height');
          if (width === 1280) {
            assert.ok(Math.max(...boxes.map(b => b.remaining.y)) - Math.min(...boxes.map(b => b.remaining.y)) <= 2, label + ': remaining panels aligned in row');
          } else if (width > 760) {
            assert.ok(Math.abs(boxes[0].remaining.y - boxes[1].remaining.y) <= 2, label + ': two-column remaining panels aligned');
          } else {
            assert.ok(boxes[0].card.width >= width - 35, label + ': full-width mobile cues');
          }

          const badge = playerPage.locator('.grid .cue .state').first();
          const badgeStyle = await badge.evaluate(el => {
            const st = getComputedStyle(el);
            const box = el.getBoundingClientRect();
            return { size: st.fontSize, paddingX: st.paddingLeft, paddingY: st.paddingTop, radius: st.borderRadius, whiteSpace: st.whiteSpace, height: box.height };
          });
          const mainBadgeStyle = await page.locator('.cue-card .cue-state').first().evaluate(el => {
            const st = getComputedStyle(el);
            return { size: st.fontSize, paddingX: st.paddingLeft, paddingY: st.paddingTop, radius: st.borderRadius, whiteSpace: st.whiteSpace };
          });
          for (const key of Object.keys(mainBadgeStyle)) assert.equal(badgeStyle[key], mainBadgeStyle[key], label + ': exported status badge matches main ' + key);
          assert.ok(badgeStyle.height < 30, label + ': exported status badge remains compact');
          const exportedFirst = playerPage.locator('.grid .cue button').first();
          await exportedFirst.click();
          await playerPage.waitForFunction(() => document.querySelector('.grid .cue button')?.getAttribute('aria-pressed') === 'true');
          assert.equal(await exportedFirst.locator('.center svg rect').count(), 2, label + ': exported play changes to pause icon');
          await exportedFirst.click();
          await playerPage.waitForFunction(() => document.querySelector('.grid .cue button')?.getAttribute('aria-pressed') === 'false');
          assert.equal(await exportedFirst.locator('.center svg path').count(), 1, label + ': exported pause changes to play icon');
          await exportedFirst.click();
          await playerPage.waitForFunction(() => document.querySelector('.grid .cue button')?.getAttribute('aria-pressed') === 'true');
          assert.ok(await playerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no exported horizontal scroll');

          await playerPage.screenshot({path: path.join(output, 'player-' + language + '-' + width + '.png'), fullPage: true});
          await playerPage.close();
          assert.deepEqual(errors, [], label + ': browser console');
          assert.deepEqual(remoteRequests, [], label + ': no external runtime requests');
          console.log('PASS music-export ' + label);
        } catch (error) {
          await page.screenshot({path: path.join(output, 'failure-' + language + '-' + width + '.png')}).catch(() => {});
          throw error;
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
