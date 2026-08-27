// recorder.mjs — the capture half of reshoot.
//
// What this is: a thin wrapper over Playwright that records a real browser session
// to video AND writes a parallel timeline of what the script did (clicks, typing,
// scrolls) with millisecond timestamps. The video deliberately contains no cursor.
// Everything expressive - cursor motion, click pulses, zoom, labels - is drawn later
// by the Remotion layer from that timeline.
//
// The contract the Remotion side depends on. Do not break these:
//  - viewport === recordVideo.size, so an event's CSS-pixel coordinate is the same
//    number as its pixel coordinate in the video. No scaling math anywhere downstream.
//  - deviceScaleFactor 2 supersamples text for sharpness. Coordinates stay in CSS px.
//  - Playwright's recordVideo never draws the cursor. That is the whole point: a
//    recorded cursor could not be re-timed, and would fight the synthetic one.
//  - t0 is stamped right after the page is created; every event.t is ms since t0.
//  - A real mouse.move still happens (with steps) so :hover states fire and get
//    recorded. Only the destination is logged - the easing between points is the
//    Remotion layer's job, so the same take can be re-timed without re-recording.
//
// Output: <outDir>/<name>.webm and <outDir>/<name>.events.json
//   { name, viewport: {width, height, dpr}, fps, t0_epoch, events: [...] }
//
// Usage:
//   const rec = await Recorder.start({ name: 'signup', outDir: 'public/captures' });
//   await rec.goto('http://localhost:5173/signup');
//   await rec.type('input[name=email]', 'ada@example.com', { label: 'Work email' });
//   await rec.click('button[type=submit]', { label: 'Create account' });
//   await rec.finish();

import { chromium } from 'playwright';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const DEFAULTS = {
  viewport: { width: 1920, height: 1080 },
  dpr: 2,
  fps: 30,
  headless: true,
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'dark',
  outDir: 'public/captures',
};

export class Recorder {
  constructor(opts) {
    Object.assign(this, opts);
    this.events = [];
    this.cursor = { x: this.viewport.width / 2, y: this.viewport.height / 2 };
  }

  static async start(userOpts = {}) {
    const o = { ...DEFAULTS, ...userOpts, viewport: { ...DEFAULTS.viewport, ...userOpts.viewport } };
    if (!o.name) throw new Error('Recorder.start needs a { name }');
    const outDir = resolve(process.cwd(), o.outDir);
    await mkdir(outDir, { recursive: true });

    const browser = await chromium.launch({
      headless: o.headless,
      // sRGB keeps recorded colours matching the design; vsync off avoids dropped frames.
      args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu-vsync'],
    });
    const context = await browser.newContext({
      viewport: o.viewport,
      deviceScaleFactor: o.dpr,
      recordVideo: { dir: outDir, size: o.viewport }, // size === viewport keeps coords 1:1
      locale: o.locale,
      timezoneId: o.timezoneId,
      colorScheme: o.colorScheme,
      reducedMotion: 'no-preference',
      ...(o.contextOptions ?? {}),
    });
    const page = await context.newPage();
    const t0 = Date.now(); // anchor: immediately after page creation

    const rec = new Recorder({ ...o, outDir, browser, context, page, t0 });
    // Park the cursor off-screen so the Remotion layer can animate its first entrance.
    rec.cursor = { x: Math.round(o.viewport.width / 2), y: o.viewport.height + 80 };
    return rec;
  }

  _log(type, x, y, extra = {}) {
    this.events.push({ t: Date.now() - this.t0, type, x: Math.round(x), y: Math.round(y), ...extra });
  }

  async goto(url, { label } = {}) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.settle();
    this._log('nav', this.cursor.x, this.cursor.y, { label: label ?? url });
    return this;
  }

  // Wait for the network to go quiet and for loading skeletons to disappear, so a
  // half-painted frame never ends up in the take.
  async settle({ skeletonSel = '[class*="skeleton"],[class*="Skeleton"],[aria-busy="true"]', timeout = 6000 } = {}) {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page
      .waitForFunction((sel) => document.querySelectorAll(sel).length === 0, skeletonSel, { timeout })
      .catch(() => {});
    return this;
  }

  // Accepts a CSS selector, a Playwright locator, or a raw {x, y}.
  async _resolve(target) {
    if (typeof target === 'object' && target !== null && 'x' in target) {
      return { x: target.x, y: target.y, locator: null };
    }
    const el = typeof target === 'string' ? this.page.locator(target).first() : target.first();
    await el.waitFor({ state: 'visible', timeout: 8000 });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const box = await el.boundingBox();
    if (!box) throw new Error(`reshoot: element has no box: ${target}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, locator: el };
  }

  async move(target, { label } = {}) {
    const { x, y } = await this._resolve(target);
    await this.page.mouse.move(x, y, { steps: 24 }); // steps so :hover fires along the way
    this.cursor = { x, y };
    this._log('move', x, y, label ? { label } : {});
    return this;
  }

  // dwellBefore gives the viewer's eye time to land before the UI changes under it.
  // noAct logs and animates the click without actually firing it, for destructive
  // buttons you want to show but not press.
  async click(target, { label, noAct = false, dwellBefore = 350, dwellAfter = 500 } = {}) {
    const { x, y, locator } = await this._resolve(target);
    await this.page.mouse.move(x, y, { steps: 24 });
    this.cursor = { x, y };
    if (dwellBefore) await this.page.waitForTimeout(dwellBefore);
    this._log('click', x, y, label ? { label } : {});
    if (!noAct) {
      if (locator) await locator.click();
      else await this.page.mouse.click(x, y);
    }
    if (dwellAfter) await this.page.waitForTimeout(dwellAfter);
    await this.settle();
    return this;
  }

  async clickText(text, { label, dwellAfter = 1200 } = {}) {
    const el = this.page.getByText(text, { exact: false }).first();
    return this.click(el, { label: label ?? text, dwellAfter });
  }

  // Types character by character. Never use locator.fill() for anything on camera:
  // instant text insertion reads as a glitch, not as someone typing.
  async type(target, text, { label, delay = 60, clear = true } = {}) {
    const { x, y, locator } = await this._resolve(target);
    await this.page.mouse.move(x, y, { steps: 20 });
    this.cursor = { x, y };
    this._log('type', x, y, { text, ...(label ? { label } : {}) });
    if (locator) {
      await locator.click();
      if (clear) await locator.fill('');
      await locator.pressSequentially(text, { delay });
    }
    await this.page.waitForTimeout(250);
    return this;
  }

  // Fills instantly and logs nothing. For setting up state during the pre-roll you
  // intend to trim off the front of the clip.
  async prefill(target, value) {
    const { locator } = await this._resolve(target);
    if (locator) await locator.fill(value);
    return this;
  }

  async select(target, value, { label } = {}) {
    const { x, y, locator } = await this._resolve(target);
    await this.page.mouse.move(x, y, { steps: 20 });
    this.cursor = { x, y };
    this._log('click', x, y, label ? { label } : {});
    if (locator) await locator.selectOption(value);
    await this.page.waitForTimeout(300);
    return this;
  }

  // Smooth continuous scroll instead of one jump, so the Remotion camera has
  // something coherent to sit on top of.
  async scroll(toY, { ms = 900 } = {}) {
    const steps = Math.max(8, Math.round(ms / 110));
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, toY / steps);
      await this.page.waitForTimeout(110);
    }
    this._log('scroll', this.cursor.x, this.cursor.y);
    return this;
  }

  async scrollTo(target, { block = 'center', dwell = 700 } = {}) {
    const el = typeof target === 'string' ? this.page.locator(target).first() : target.first();
    await el.evaluate((node, b) => node.scrollIntoView({ behavior: 'smooth', block: b }), block).catch(() => {});
    await this.page.waitForTimeout(dwell);
    this._log('scroll', this.cursor.x, this.cursor.y);
    return this;
  }

  async dwell(ms) {
    await this.page.waitForTimeout(ms);
    return this;
  }

  // Optional frame-accurate anchor: flashes magenta for ~2 frames. If you ever see
  // the overlay drift against the video, render this in and line the layers up to it.
  async flashMarker() {
    await this.page.evaluate(() => {
      const d = document.createElement('div');
      Object.assign(d.style, {
        position: 'fixed', inset: '0', background: '#FF00FF', zIndex: '2147483647',
      });
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 70);
    });
    this._log('flash', 0, 0);
    await this.page.waitForTimeout(120);
    return this;
  }

  async finish() {
    const video = this.page.video();
    await this.context.close(); // closing the context is what finalises the video file
    await this.browser.close();

    const webm = join(this.outDir, `${this.name}.webm`);
    const rawPath = await video.path();
    // rename fails across volumes; the raw path is still a valid video, so carry on.
    await rename(rawPath, webm).catch(() => {});

    const json = join(this.outDir, `${this.name}.events.json`);
    await writeFile(
      json,
      JSON.stringify(
        {
          name: this.name,
          viewport: { ...this.viewport, dpr: this.dpr },
          fps: this.fps,
          t0_epoch: this.t0,
          events: this.events,
        },
        null,
        2
      )
    );
    console.log(`reshoot: ${this.name} -> ${webm} (${this.events.length} events)`);
    return { webm, json };
  }
}
