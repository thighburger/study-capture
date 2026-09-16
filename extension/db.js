const ready = new Promise((resolve,reject) => {
  const r=indexedDB.open('study-capture',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('pages',{keyPath:'id',autoIncrement:true});
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function run(mode, action) {
  const db=await ready;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('pages',mode), request=action(tx.objectStore('pages'));
    tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('저장 취소'));
  });
}
export const getPages=()=>run('readonly',s=>s.getAll());
export const addPage=page=>run('readwrite',s=>s.add(page));
export const deletePage=id=>run('readwrite',s=>s.delete(id));
export const clearPages=()=>run('readwrite',s=>s.clear());
