/** Machine-specific references; these do not change shop stock or place orders. */
import { assertCan, can } from '../auth/authz.ts';
import { requireAsset } from '../domain/assets.ts';
import { normalizeUrl } from '../domain/jobs.ts';
import { optionalField, readFields, requiredField, type RequestContext } from '../api/context.ts';
import { json, redirect } from '../api/responses.ts';
import type { Router } from '../api/router.ts';
import { badRequest, notFound } from '../platform/errors.ts';
import { newId, nowIso } from '../platform/ids.ts';
import { html, raw } from '../ui/html.ts';
import { page, externalLink } from '../ui/layout.ts';
import { wantsJson } from './equipment.ts';

interface PartReference {
 id: string; name: string; oem_number: string | null; aftermarket_number: string | null;
 supplier: string | null; supplier_url: string | null; source_url: string | null;
 fit_status: string; evidence: string | null; notes: string | null;
}
export function registerEquipmentParts(router: Router) {
 router.get('/equipment/:id/parts', renderParts);
 router.post('/api/equipment/:id/parts', savePart);
}
async function renderParts(ctx: RequestContext): Promise<Response> {
 assertCan(ctx.actor, 'inventory.read');
 const asset = await requireAsset(ctx.db, ctx.params.id);
 const { results } = await ctx.db.prepare('SELECT * FROM asset_part_references WHERE asset_id = ? ORDER BY name, supplier').bind(asset.id).all<PartReference>();
 const form = (part?: PartReference) => html`<form method="post" action="/api/equipment/${asset.id}/parts">
 ${part ? html`<input type="hidden" name="part_reference_id" value="${part.id}">` : ''}
 <label>Part name<input name="name" required maxlength="160" value="${part?.name ?? ''}" placeholder="Engine oil filter"></label>
 <label>Original manufacturer part number<input name="oem_number" value="${part?.oem_number ?? ''}"></label>
 <label>Aftermarket brand and part number<input name="aftermarket_number" value="${part?.aftermarket_number ?? ''}"></label>
 <label>Supplier<input name="supplier" value="${part?.supplier ?? ''}"></label>
 <label>Purchase link<input name="supplier_url" type="url" value="${part?.supplier_url ?? ''}"></label>
 <label>Parts diagram or source link<input name="source_url" type="url" value="${part?.source_url ?? ''}"></label>
 <label>Does it fit this machine?<select name="fit_status"><option value="unverified">Needs checking — do not order yet</option><option value="confirmed" ${raw(part?.fit_status === 'confirmed' ? 'selected' : '')}>Confirmed for this machine</option></select></label>
 <label>How was the fit confirmed?<textarea name="evidence" placeholder="Dealer confirmation against the machine serial, or verified manufacturer cross-reference">${part?.evidence ?? ''}</textarea></label>
 <label>Notes<textarea name="notes" placeholder="Quantity needed, service interval, or ordering notes">${part?.notes ?? ''}</textarea></label>
 <button type="submit">Save part</button></form>`;
 return page(html`<h1>Parts for ${asset.asset_tag}</h1><p>${asset.manufacturer ?? ''} ${asset.model ?? ''} · Serial / VIN: ${asset.serial_number ?? asset.vin ?? 'Not recorded'}</p>
 <p class="lede">Save common parts and places to buy them. Each supplier can have its own entry. This list does not place orders.</p>
 ${(can(ctx.actor, 'inventory.manage') || can(ctx.actor, 'asset.write')) ? html`<details class="card"><summary><strong>Add a part</strong></summary>${form()}</details>` : ''}
 ${results.length ? results.map(part => html`<article class="card"><h2>${part.name}</h2>
 <p class="notice">${part.fit_status === 'confirmed' ? 'Fit confirmed for this machine' : 'Needs checking — do not order yet'}</p>
 <p>Manufacturer: ${part.oem_number ?? 'Not recorded'}<br>Aftermarket: ${part.aftermarket_number ?? 'Not recorded'}<br>Supplier: ${part.supplier ?? 'Not recorded'}</p>
 ${part.supplier_url ? externalLink(part.supplier_url, 'View supplier') : ''} ${part.source_url ? externalLink(part.source_url, 'View source') : ''}
 ${part.evidence ? html`<p>Fit evidence: ${part.evidence}</p>` : ''}${part.notes ? html`<p>${part.notes}</p>` : ''}
 ${(can(ctx.actor, 'inventory.manage') || can(ctx.actor, 'asset.write')) ? html`<details><summary>Edit this part</summary>${form(part)}</details>` : ''}</article>`) : html`<p>No parts saved yet. Add the first known part or a candidate that needs checking.</p>`}`,
 { title: 'Machine parts', actor: ctx.actor, section: '/equipment', back: { href: `/equipment/${asset.id}`, label: 'Equipment' } });
}
async function savePart(ctx: RequestContext): Promise<Response> {
 if (!can(ctx.actor, 'asset.write')) assertCan(ctx.actor, 'inventory.manage');
 const asset = await requireAsset(ctx.db, ctx.params.id);
 const fields = await readFields(ctx.request);
 const name = requiredField(fields, 'name', 'Part name');
 if (name.length > 160) throw badRequest('Keep the part name under 160 characters');
 const status = optionalField(fields, 'fit_status') ?? 'unverified';
 if (!['unverified', 'confirmed'].includes(status)) throw badRequest('Choose whether fit is confirmed');
 const evidence = optionalField(fields, 'evidence');
 if (status === 'confirmed' && !evidence) throw badRequest('Record how fit was confirmed for this machine');
 const existing = optionalField(fields, 'part_reference_id');
 if (existing && !await ctx.db.prepare('SELECT id FROM asset_part_references WHERE id = ? AND asset_id = ?').bind(existing, asset.id).first()) throw notFound('Part reference not found on this machine');
 const id = existing ?? newId('apr');
 const values = [name, optionalField(fields, 'oem_number'), optionalField(fields, 'aftermarket_number'), optionalField(fields, 'supplier'), normalizeUrl(fields.supplier_url), normalizeUrl(fields.source_url), status, evidence, optionalField(fields, 'notes'), ctx.actor.employeeId, nowIso()];
 if (existing) await ctx.db.prepare('UPDATE asset_part_references SET name=?,oem_number=?,aftermarket_number=?,supplier=?,supplier_url=?,source_url=?,fit_status=?,evidence=?,notes=?,updated_by=?,updated_at=? WHERE id=? AND asset_id=?').bind(...values,id,asset.id).run();
 else await ctx.db.prepare('INSERT INTO asset_part_references (name,oem_number,aftermarket_number,supplier,supplier_url,source_url,fit_status,evidence,notes,updated_by,updated_at,id,asset_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,id,asset.id).run();
 return wantsJson(ctx) ? json({ id }, existing ? 200 : 201) : redirect(`/equipment/${asset.id}/parts`);
}
