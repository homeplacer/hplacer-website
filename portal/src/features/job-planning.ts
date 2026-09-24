import { assertCan, can } from '../auth/authz.ts';
import { requireJob, normalizeUrl } from '../domain/jobs.ts';
import { normalizeAddress } from '../domain/matching.ts';
import { createTask, requireTask, setTaskStatus, listTasks } from '../domain/tasks.ts';
import { readFields, optionalField, requiredField, type RequestContext } from '../api/context.ts';
import { redirect } from '../api/responses.ts';
import type { Router } from '../api/router.ts';
import { badRequest } from '../platform/errors.ts';
import { html } from '../ui/html.ts';
import { page } from '../ui/layout.ts';
export function registerJobPlanning(router:Router) {
 router.get('/subdivisions/:id/planning',render);
 router.post('/api/subdivisions/:id/details',save);
 router.post('/api/subdivisions/:id/checklist',task);
}
async function render(ctx:RequestContext) {
 assertCan(ctx.actor,'job.read'); const j=await requireJob(ctx.db,ctx.params.id);
 const results=await listTasks(ctx.db,ctx.actor,{jobId:j.id,includeAvailableForCrew:true,limit:1000});
 return page(html`<h1>Plan ${j.title}</h1>
 ${can(ctx.actor,'job.write')?html`<details class="card"><summary>Update job details</summary><form method="post" action="/api/subdivisions/${j.id}/details">
 <label>Job name<input name="title" required value="${j.title}"></label>
 <label>Address<input name="street_address" value="${j.street_address??''}"></label><label>City<input name="city" value="${j.city??''}"></label><label>State<input name="state" value="${j.state??''}"></label><label>ZIP<input name="postal_code" value="${j.postal_code??''}"></label>
 <label>Google Maps link<input name="google_maps_url" type="url" value="${j.google_maps_url??''}"></label><label>Document folder link<input name="drive_folder_url" type="url" value="${j.drive_folder_url??''}"></label><label>Notes<textarea name="notes">${j.notes??''}</textarea></label><button>Save details</button></form></details>`:''}
 <h2>Job checklist</h2><p>Add the steps this site needs. Owners can stay blank. Removing an open step cancels it and keeps its history.</p>
 ${results.map(t=>html`<div class="card"><a href="/tasks/${t.id}">${t.title}</a><p>${t.status}</p>
 ${can(ctx.actor,'task.assign') && !['complete','cancelled'].includes(t.status)?html`<form method="post" action="/api/subdivisions/${j.id}/checklist"><input type="hidden" name="task_id" value="${t.id}"><label>Step name<input name="title" required value="${t.title}"></label><button name="action" value="rename">Save name</button><button class="secondary" name="action" value="cancel">Remove step</button></form>`:''}</div>`)}
 ${can(ctx.actor,'task.assign')?html`<form class="card" method="post" action="/api/subdivisions/${j.id}/checklist"><h2>Add a step</h2><label>What needs doing?<input name="title" required placeholder="Build the pad"></label><button name="action" value="add">Add unassigned step</button></form>`:''}`,
 {title:'Job planning',actor:ctx.actor,section:'/subdivisions',back:{href:`/subdivisions/${j.id}`,label:'Job'}});
}
async function save(ctx:RequestContext) {
 assertCan(ctx.actor,'job.write');const j=await requireJob(ctx.db,ctx.params.id);const f=await readFields(ctx.request);
 const address=optionalField(f,'street_address'),city=optionalField(f,'city'),state=optionalField(f,'state'),zip=optionalField(f,'postal_code');
 await ctx.db.prepare('UPDATE jobs SET title=?,street_address=?,city=?,state=?,postal_code=?,google_maps_url=?,drive_folder_url=?,notes=?,address_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(requiredField(f,'title','Job name'),address,city,state,zip,normalizeUrl(f.google_maps_url),normalizeUrl(f.drive_folder_url),optionalField(f,'notes'),normalizeAddress({address,city,state,postalCode:zip})?.key??null,j.id).run();
 return redirect(`/subdivisions/${j.id}/planning`);
}
async function task(ctx:RequestContext) {
 assertCan(ctx.actor,'task.assign'); const j=await requireJob(ctx.db,ctx.params.id);const f=await readFields(ctx.request);
 if(f.action==='add') await createTask(ctx.db,ctx.actor,{title:requiredField(f,'title','Step name'),jobId:j.id});
 else {
 const t=await requireTask(ctx.db,requiredField(f,'task_id','Task'));if(t.job_id!==j.id)throw badRequest('That task belongs to another job');
 if(['complete','cancelled'].includes(t.status))throw badRequest('This step is already finished or removed');
 if(f.action==='cancel')await setTaskStatus(ctx.db,ctx.actor,t.id,'cancelled');
 else if(f.action==='rename')await ctx.db.prepare("UPDATE work_tasks SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('complete','cancelled')").bind(requiredField(f,'title','Step name'),t.id).run();
 else throw badRequest('Choose a checklist action');
 }
 return redirect(`/subdivisions/${j.id}/planning`);
}
