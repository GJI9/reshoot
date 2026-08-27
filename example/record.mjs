// Records the sample app in example/app and writes the take to public/captures.
// Run with: npm run example:record
//
// Nothing here is reshoot-specific plumbing - this is what a real script looks like.
// Point `goto` at your own dev server and rewrite the middle.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Recorder } from '../record/recorder.mjs';

const app = pathToFileURL(resolve('example/app/index.html')).href;

const rec = await Recorder.start({
  name: 'demo',
  outDir: 'public/captures',
  // headless: false lets you watch the take being made while you tune it.
  headless: true,
});

await rec.goto(app);
await rec.dwell(900); // a beat of the untouched list before anything moves

await rec.click('#new', { label: 'New expense' });
await rec.type('#vendor', 'Alder & Finch Studio', { label: 'Vendor' });
await rec.select('#category', 'Marketing', { label: 'Category' });
await rec.type('#amount', '2480', { label: 'Amount' });
await rec.dwell(400);
await rec.click('#save', { label: 'Submit for approval' });
await rec.dwell(500);
// Walking the cursor back over the table pulls the auto zoom out with it, so the
// closing shot shows the new row in the context of the full list.
await rec.move({ x: 700, y: 300 });
await rec.dwell(1600);

await rec.finish();
