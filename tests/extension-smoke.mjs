import {chromium} from 'playwright';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'study-capture-'));
let context;
try{
 const extension=resolve('extension');
 context=await chromium.launchPersistentContext(dir,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`chrome-extension://${id}/panel.html`);
 await page.waitForFunction(()=>document.querySelector('#new')&&!document.querySelector('#new').disabled);
 assert.equal(await page.title(),'모아 — 학습자료 만들기');
 assert.deepEqual(errors,[]);
 console.log('PASS: real Manifest V3 extension loads in Chromium; service worker, side panel document, IndexedDB and bundled PDF library initialize without errors.');
}finally{await context?.close();await rm(dir,{recursive:true,force:true});}
