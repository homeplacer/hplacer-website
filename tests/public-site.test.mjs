import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function loadTs(path) {
  const {outputText} = ts.transpileModule(readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const analytics = await loadTs('src/lib/analytics.ts');
test('analytics excludes personal fields, unrecognized model text, query strings, and arbitrary paths', () => {
  const calls=[];
  globalThis.window={location:{pathname:'/contact/private@example.com',search:'?email=private@example.com'},gtag:(...x)=>calls.push(x)};
  analytics.track('generate_lead',{form_type:'contact',email:'private@example.com',phone:'5551234567',model_context:'Please call private@example.com',page_path:'/contact/private@example.com',message:'secret'});
  const payload=calls[0][2];
  assert.equal(payload.page_location,'https://hplacer.com/contact');
  assert.equal(payload.page_referrer,'');
  assert.equal(payload.page_path,'/contact');
  assert.equal(payload.form_type,'contact');
  assert.doesNotMatch(JSON.stringify(payload),/private@|555123|secret|model_context/);
});
test('every current model has a safe analytics identifier; unknown encoded paths are rejected',()=> {
  const models=JSON.parse(readFileSync('data/models.json','utf8'));
  for(const model of models) assert.equal(analytics.modelSlugFromPath(`/homes/${model.slug}`),model.slug);
  assert.equal(analytics.modelSlugFromPath('/homes/private%40example.com'),null);
  assert.equal(analytics.analyticsPath('/unknown/private@example.com'),'/');
});
test('events queue safely before analytics script loads',()=> {
  globalThis.window={location:{pathname:'/homes/stayin-alive'}};
  analytics.track('view_model',{model_context:'stayin-alive'});
  assert.equal(window.dataLayer.length,1);
  assert.equal(window.dataLayer[0][2].model_context,'stayin-alive');
});
test('only documented legacy paths map to real current models',async()=> {
  const {legacyRedirects}=await loadTs('src/lib/legacy-redirects.ts');
  const slugs=new Set(JSON.parse(readFileSync('data/models.json','utf8')).map(x=>`/homes/${x.slug}`));
  for(const path of Object.values(legacyRedirects)) assert.ok(slugs.has(path));
  assert.equal(legacyRedirects['/product-page/conway-land-package'],'/homes/stayin-alive');
  assert.equal(legacyRedirects['/product-page/unknown'],undefined);
});
