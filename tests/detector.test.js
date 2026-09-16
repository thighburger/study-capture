import test from 'node:test';
import assert from 'node:assert/strict';
import {difference,Detector} from '../extension/detector.js';
const frame=(value=0)=>new Uint8ClampedArray(400).fill(value);
test('first stable frame saved once, then identical frames suppressed',()=>{
 const d=new Detector();assert.equal(d.observe(frame(),0),false);assert.equal(d.observe(frame(),650),true);d.commit(frame());assert.equal(d.observe(frame(),1300),false);
});
test('transition is not saved until stable and meaningful change occurs',()=>{
 const d=new Detector();d.commit(frame());assert.equal(d.observe(frame(50),0),false);assert.equal(d.observe(frame(100),650),false);assert.equal(d.observe(frame(100),1300),true);
});
test('small noise is ignored and changed pixel fraction is correct',()=>{
 assert.equal(difference(frame(),frame(20)),0);const b=frame();b[0]=255;assert.equal(difference(frame(),b),.01);
 const d=new Detector(.03);d.commit(frame());d.observe(b,0);assert.equal(d.observe(b,650),false);
});
test('slow incremental motion cannot evade stability anchor',()=>{
 const d=new Detector();d.commit(frame());d.observe(frame(30),0);assert.equal(d.observe(frame(45),300),false);assert.equal(d.observe(frame(60),650),false);assert.equal(d.observe(frame(60),1300),true);
});
