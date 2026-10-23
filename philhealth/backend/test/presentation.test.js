import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chartGeometry } from '../../frontend/js/chart-math.js';
const sample={totals:{committed:4000000000,ceiling:5000000000},settings:{as_of_date:'2026-10-15'},forecast:{projected:6000000000,horizonWeeks:4,weeks:[{week:'2026-10-01',amount:1000000000},{week:'2026-10-08',amount:2000000000},{week:'2026-10-15',amount:1000000000}]}};
test('chart presentation keeps actual, forecast and ceiling in bounds at mobile/desktop widths',()=>{
 for(const width of [280,360,600,1200]){const g=chartGeometry(sample,width);assert.equal(g.width,width);for(const p of [...g.actual,g.future]){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=g.left&&p.x<=g.right);assert.ok(p.y>=g.top&&p.y<=g.bottom);}assert.equal(g.actual.at(-1).value,sample.totals.committed);assert.ok(g.ceilingY>g.top&&g.ceilingY<g.bottom);assert.equal(g.future.value,sample.forecast.projected);}
 const empty=chartGeometry({...sample,forecast:{...sample.forecast,weeks:[]}},0);assert.equal(empty.actual.length,1);assert.equal(empty.actual[0].value,sample.totals.committed);
});
function themeFixture(saved='automatic',dark=false,blocked=false){
 const events={},mediaEvents={},store=new Map([['phcm-theme',saved]]),root={dataset:{},style:{}};
 const media={matches:dark,addEventListener:(name,fn)=>mediaEvents[name]=fn};const window={matchMedia:()=>media,addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:()=>{}};
 const localStorage={getItem:key=>{if(blocked)throw Error('Storage blocked');return store.get(key);},setItem:(key,value)=>{if(blocked)throw Error('Storage blocked');store.set(key,value);}};
 const context=vm.createContext({window,document:{documentElement:root},localStorage,CustomEvent:class{}});vm.runInContext(readFileSync(new URL('../../frontend/js/theme.js',import.meta.url),'utf8'),context);
 return {window,root,store,media,events,mediaEvents};
}
test('theme applies persisted choice before UI, follows live OS changes only in Automatic, and persists overrides',()=>{
 const f=themeFixture('automatic',false);assert.equal(f.root.dataset.theme,'light');f.media.matches=true;f.mediaEvents.change();assert.equal(f.root.dataset.theme,'dark');f.window.philhealthTheme.setChoice('light');assert.equal(f.store.get('phcm-theme'),'light');f.mediaEvents.change();assert.equal(f.root.dataset.theme,'light');assert.equal(f.root.style.colorScheme,'light');assert.equal(themeFixture('dark',false).root.dataset.theme,'dark');f.events.storage({key:'phcm-theme',newValue:'dark'});assert.equal(f.root.dataset.theme,'dark');assert.equal(themeFixture('invalid',true).root.dataset.theme,'dark');assert.equal(themeFixture('automatic',true,true).root.dataset.theme,'dark');
});
