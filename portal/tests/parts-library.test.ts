import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createHarness, form, type Harness } from './harness.ts';
describe('machine parts library and repair documentation', () => {
 let h: Harness;
 beforeEach(async () => { h = await createHarness(); });
 afterEach(() => h.close());
 it('lets supervisors save candidates and employees read them without granting edit access', async () => {
  const saved = await h.request('/api/equipment/EX-01/parts', { as: 'brandon@hplacer.com', ...form({ name: 'Oil filter', oem_number: 'TEST-1', supplier_url: 'https://example.com/filter' }) });
  assert.equal(saved.status,303);
  const view = await (await h.request('/equipment/EX-01/parts',{as:'dale@hplacer.com'})).text();
  assert.match(view,/Oil filter/); assert.match(view,/Needs checking — do not order yet/); assert.doesNotMatch(view,/Save part/);
  assert.equal((await h.request('/api/equipment/EX-01/parts',{as:'dale@hplacer.com',...form({name:'Unauthorized'})})).status,403);
 });
 it('requires evidence for confirmed fit and rejects unsafe source links',async () => {
  for(const values of [{name:'Filter',fit_status:'confirmed'},{name:'Filter',source_url:'javascript:alert(1)'}]) {
   assert.equal((await h.request('/api/equipment/EX-01/parts',form(values))).status,400);
  }
  assert.equal((await h.request('/api/equipment/EX-01/parts',form({name:'Filter',fit_status:'confirmed',evidence:'Dealer confirmed against the serial on this machine'}))).status,303);
 });
 it('cannot move another machine’s part reference by editing its identifier',async () => {
  await h.request('/api/equipment/EX-01/parts',form({name:'Filter'}));
  const row=await h.db.prepare('SELECT id FROM asset_part_references').first<{id:string}>();
  assert.equal((await h.request('/api/equipment/SS-02/parts',form({name:'Wrong machine',part_reference_id:row!.id}))).status,404);
 });
 it('stores a named repair receipt while retaining the original filename', async () => {
  const body=new FormData(); body.set('repair_ticket_id','rep_1'); body.set('document_type','receipt'); body.set('caption','Parts receipt'); body.set('file',new File(['receipt'],'scan.pdf',{type:'application/pdf'}));
  const response=await h.request('/api/documents/upload',{method:'POST',body}); assert.equal(response.status,303);
  const row=await h.db.prepare("SELECT file_name,caption FROM documents WHERE caption='Parts receipt'").first<{file_name:string;caption:string}>();
  assert.equal(row?.file_name,'scan.pdf');
  const detail=await (await h.request('/repairs/rep_1')).text(); assert.match(detail,/<h3>Parts receipt<\/h3>/);
 });
 it('asks for a useful name before saving a repair attachment',async () => {
  const body=new FormData(); body.set('repair_ticket_id','rep_1'); body.set('file',new File(['photo'],'image.jpg',{type:'image/jpeg'}));
  assert.equal((await h.request('/api/documents/upload',{method:'POST',body})).status,400);
 });
});
