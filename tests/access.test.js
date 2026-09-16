import test from 'node:test';
import assert from 'node:assert/strict';
import {connectActiveTab} from '../extension/access.js';
function api(tab, error) {
  const calls=[];
  return {calls,tabs:{query:async()=>tab?[tab]:[]},scripting:{executeScript:async args=>{calls.push(args);if(error)throw Error(error);}}};
}
test('missing URL metadata does not incorrectly reject a regular tab',async()=>{
  const mock=api({id:12,windowId:1});assert.equal((await connectActiveTab(mock)).id,12);assert.equal(mock.calls.length,1);
});
test('missing activeTab permission has specific recovery instructions',async()=>{
  const mock=api({id:12},'Cannot access contents of the page. Extension manifest must request permission');
  await assert.rejects(connectActiveTab(mock),/퍼즐 아이콘 → 모아/);
});
test('restricted pages are rejected separately from missing permission',async()=>{
  for(const url of ['chrome://newtab/','https://chromewebstore.google.com/detail/test','https://chrome.google.com/webstore/detail/test']){
    const mock=api({id:12,url});await assert.rejects(connectActiveTab(mock),/일반 웹페이지/);assert.equal(mock.calls.length,0);
  }
});
test('ordinary sites connect, absent tabs and unexpected failures retain useful errors',async()=>{
  assert.equal((await connectActiveTab(api({id:12,url:'https://example.com'}))).id,12);
  await assert.rejects(connectActiveTab(api(null)),/현재 탭을 찾을/);
  await assert.rejects(connectActiveTab(api({id:12},'No tab with id: 12')),/No tab with id: 12/);
});
