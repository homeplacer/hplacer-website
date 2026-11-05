import { assertCan, can } from '../auth/authz.ts';
import { requireRepair, assertCanViewRepair } from '../domain/repairs.ts';
import { readFields, optionalField, type RequestContext } from '../api/context.ts';
import { redirect, json } from '../api/responses.ts';
import type { Router } from '../api/router.ts';
import { badRequest } from '../platform/errors.ts';
import { nowIso } from '../platform/ids.ts';
import { html, raw } from '../ui/html.ts';
import { money } from '../ui/layout.ts';
import { wantsJson } from './equipment.ts';
interface Work { date_from: string|null; date_to:string|null; mechanic:string|null; work_summary:string|null; labor_hours:number|null; parts_cost_cents:number|null; cost_is_estimate:number; supplier:string|null; completion_reported:number; }
export function registerRepairWork(router: Router) { router.post('/api/repairs/:id/work-details', save); }
export async function repairWorkSection(ctx: RequestContext, id: string) {
 const w = await ctx.db.prepare('SELECT * FROM repair_work_details WHERE repair_id=?').bind(id).first<Work>();
 return html`<h2>Work performed</h2><div class="card">
 <p><strong>${w?.completion_reported ? 'Reported finished' : 'Completion not recorded'}</strong></p>
 <p>Date: ${w?.date_from ?? 'Not recorded'}${w?.date_to && w.date_to !== w.date_from ? ` to ${w.date_to} (approximate)` : ''}<br>Mechanic: ${w?.mechanic ?? 'Not recorded'}<br>Labor time: ${w?.labor_hours != null ? `${w.labor_hours} hours (reported)` : 'Not recorded'}<br>Parts cost: ${w?.parts_cost_cents != null ? `${money(w.parts_cost_cents)}${w.cost_is_estimate ? ' (estimated)' : ' (confirmed)'}` : 'Not recorded'}<br>Supplier: ${w?.supplier ?? 'Not recorded'}</p>
 ${w?.work_summary ? html`<p>${w.work_summary}</p>` : ''}
 <p class="meta">Reported work details do not set billing charges or approve a bill-back.</p>
 ${can(ctx.actor,'repair.edit') ? html`<details><summary>Edit work details</summary><form method="post" action="/api/repairs/${id}/work-details">
 <label>Repair date<input type="date" name="date_from" value="${w?.date_from ?? ''}"></label>
 <label>Latest possible date (if unsure)<input type="date" name="date_to" value="${w?.date_to ?? ''}"></label>
 <label>Mechanic<input name="mechanic" value="${w?.mechanic ?? ''}" placeholder="Name or outside shop"></label>
 <label>What was done?<textarea name="work_summary">${w?.work_summary ?? ''}</textarea></label>
 <label>Labor hours<input name="labor_hours" type="number" min="0" step="0.25" value="${w?.labor_hours ?? ''}"></label>
 <label>Parts cost (USD)<input name="parts_cost" type="number" min="0" step="0.01" value="${w?.parts_cost_cents != null ? (w.parts_cost_cents/100).toFixed(2) : ''}"></label>
 <label><input type="checkbox" name="cost_is_estimate" value="on" ${raw(!w || w.cost_is_estimate ? 'checked' : '')}> Cost is an estimate</label>
 <label>Supplier<input name="supplier" value="${w?.supplier ?? ''}"></label>
 <label><input type="checkbox" name="completion_reported" value="on" ${raw(w?.completion_reported ? 'checked' : '')}> Repair work is finished</label>
 <button>Save work details</button></form></details>` : ''}</div>`;
}
async function save(ctx:RequestContext) {
 assertCan(ctx.actor,'repair.edit'); const r=await requireRepair(ctx.db,ctx.params.id); assertCanViewRepair(ctx.actor,r);
 if(r.status==='closed'||r.status==='billed') throw badRequest('This repair is closed to work-detail edits');
 const f=await readFields(ctx.request);
 const date=(key:string)=> { const v=optionalField(f,key); if(v && (!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)) throw badRequest('Enter a valid repair date'); return v; };
 const from=date('date_from'), to=date('date_to'); if(to && (!from||to<from)) throw badRequest('The end date must be on or after the repair date');
 const num=(key:string)=> { const raw=optionalField(f,key); if(raw==null)return null; const n=Number(raw); if(!Number.isFinite(n)||n<0||n>10000000)throw badRequest('Enter a valid positive amount'); return n; };
 const hours=num('labor_hours'),cost=num('parts_cost');
 await ctx.db.prepare(`INSERT INTO repair_work_details (repair_id,date_from,date_to,mechanic,work_summary,labor_hours,parts_cost_cents,cost_is_estimate,supplier,completion_reported,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(repair_id) DO UPDATE SET date_from=excluded.date_from,date_to=excluded.date_to,mechanic=excluded.mechanic,work_summary=excluded.work_summary,labor_hours=excluded.labor_hours,parts_cost_cents=excluded.parts_cost_cents,cost_is_estimate=excluded.cost_is_estimate,supplier=excluded.supplier,completion_reported=excluded.completion_reported,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(r.id,from,to,optionalField(f,'mechanic'),optionalField(f,'work_summary'),hours,cost==null?null:Math.round(cost*100),f.cost_is_estimate==='on'?1:0,optionalField(f,'supplier'),f.completion_reported==='on'?1:0,ctx.actor.employeeId,nowIso()).run();
 return wantsJson(ctx)?json({ok:true}):redirect(`/repairs/${r.id}`);
}
