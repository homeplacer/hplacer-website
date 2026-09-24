import assert from 'node:assert/strict';
import {beforeEach,afterEach,describe,it} from 'node:test';
import {createHarness,form,type Harness} from './harness.ts';
describe('repair work and flexible job planning',()=>{
 let h:Harness;beforeEach(async()=>{h=await createHarness();});afterEach(()=>h.close());
 it('keeps approximate work and costs separate from billable charges',async()=>{
  const r=await h.request('/api/repairs/rep_2/work-details',{as:'brandon@hplacer.com',...form({date_from:'2026-09-15',date_to:'2026-09-16',mechanic:'Cliff',labor_hours:'2',parts_cost:'175',cost_is_estimate:'on',completion_reported:'on'})});assert.equal(r.status,303);
  const view=await(await h.request('/repairs/rep_2')).text();assert.match(view,/Cliff/);assert.match(view,/175.00.*estimated/);assert.match(view,/Reported finished/);
  const data=await h.db.prepare("SELECT bill_back_amount_cents,status FROM repair_tickets WHERE id='rep_2'").first<{bill_back_amount_cents:number|null;status:string}>();assert.equal(data?.bill_back_amount_cents,null);assert.equal(data?.status,'awaiting_parts');
 });
 it('rejects invalid dates, costs and unauthorized edits',async()=>{
  for(const f of [{date_from:'2026-02-30'},{date_from:'2026-09-16',date_to:'2026-09-15'},{parts_cost:'-1'}])assert.equal((await h.request('/api/repairs/rep_2/work-details',form(f))).status,400);
  assert.equal((await h.request('/api/repairs/rep_2/work-details',{as:'dale@hplacer.com',...form({mechanic:'No'})})).status,403);
 });
 it('starts a job with just an address and offers planning jobs for task assignment',async()=>{
  const r=await h.request('/api/subdivisions',{...form({street_address:'123 Test Lane',status:'planning'}),headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'}});assert.equal(r.status,201);
  const {id}=await r.json() as {id:string}; const j=await h.db.prepare('SELECT title,job_number FROM jobs WHERE id=?').bind(id).first<{title:string;job_number:string}>();assert.equal(j?.title,'123 Test Lane');assert.ok(j?.job_number);
  assert.match(await(await h.request('/tasks/new')).text(),/123 Test Lane/);
  assert.equal((await h.request(`/api/subdivisions/${id}/details`,form({title:'Confirmed site',street_address:'125 Test Lane'}))).status,303);
 });
 it('keeps coworkers assigned tasks private on the planning screen',async()=>{
  await h.request('/api/tasks',form({title:'Private coworker assignment',job_id:'job_2601',assigned_to:'emp_wes'}));
  await h.request('/api/tasks',form({title:'Available crew work',job_id:'job_2601'}));
  const view=await(await h.request('/subdivisions/job_2601/planning',{as:'dale@hplacer.com'})).text();
  assert.doesNotMatch(view,/Private coworker assignment/);assert.match(view,/Available crew work/);
 });
 it('adds, renames and cancels site-specific unassigned tasks without touching other jobs',async()=>{
  assert.equal((await h.request('/api/subdivisions/job_2601/checklist',form({action:'add',title:'Prepare pad'}))).status,303);
  const t=await h.db.prepare("SELECT id,assigned_to FROM work_tasks WHERE title='Prepare pad'").first<{id:string;assigned_to:string|null}>();assert.equal(t?.assigned_to,null);
  assert.equal((await h.request('/api/subdivisions/job_2604/checklist',form({action:'rename',task_id:t!.id,title:'Wrong job'}))).status,400);
  assert.equal((await h.request('/api/subdivisions/job_2601/checklist',form({action:'rename',task_id:t!.id,title:'Prepare gravel pad'}))).status,303);
  assert.equal((await h.request('/api/subdivisions/job_2601/checklist',form({action:'cancel',task_id:t!.id}))).status,303);
  assert.equal((await h.db.prepare('SELECT status FROM work_tasks WHERE id=?').bind(t!.id).first<{status:string}>())?.status,'cancelled');
 });
});
