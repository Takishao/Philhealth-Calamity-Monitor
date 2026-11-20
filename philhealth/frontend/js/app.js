import { brand } from './brand.js?v=3d-20261023';
import { watchDropdowns } from './dropdowns.js';
import { api, setCsrfToken } from './api.js';
import { el, toast, themeControl } from './ui.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { claimsView } from './views/claims.js';
import { settingsView } from './views/settings.js';

import { eventId,setEvent } from './context.js';
import { moduleView } from './views/modules.js';
const root = document.querySelector('#app');
let user;
let renderVersion=0;
const pages = [['events','Events & budgets',['CFB','EXE','AUD']],['requests','Provider requests',['CFB','EXE','ROS','RVP','AUD']],['dashboard', 'Dashboard', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['claims', 'Claims', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['exceptions', 'Exceptions', ['CFB', 'ROS', 'ACT','EXE','AUD','RVP']], ['analytics', 'Analytics', ['CFB', 'EXE','AUD']], ['reports', 'Reports', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['audit', 'Audit trail', ['AUD', 'CFB']], ['settings', 'Admin', ['ADM']]];


async function render() {
  const version=++renderVersion;root.setAttribute('aria-busy','true');root.querySelector('.loading')?.remove();root.prepend(el('p',{class:'loading',role:'status'},'Loading workspace…'));
  try {
    if (!user) { const session = await api('/me'); user = session.user; setCsrfToken(session.csrfToken); }
    let route = location.hash.slice(1) || 'dashboard';
    const permitted = pages.filter(page => page[2].includes(user.role));
    if (!permitted.some(page => page[0] === route)) {
      route = permitted[0][0];
      history.replaceState(null, '', `#${route}`);
    }
    const nav = el('nav', { class: 'nav' }, pages.filter(page => page[2].includes(user.role)).map(page => el('a', { href: `#${page[0]}`, class: route === page[0] ? 'active' : '' }, page[1])));
    const logout = el('button', { class: 'primary', onclick: async () => { try { await api('/logout', { method: 'POST' }); user = null; setCsrfToken(''); render(); } catch (error) { toast(error.message, 'error'); } } }, 'Log out');
    const theme=themeControl();
    const events=await api(route==='events'?'/events':'/events?summary=1');if(!events.some(e=>e.id===eventId)&&events.length)setEvent(events[0].id);
    const selector=el('select',{'aria-label':'Selected event',onchange:e=>{setEvent(e.target.value);render();}},events.map(e=>el('option',{value:e.id,selected:e.id===eventId?'':null},e.name)));
    selector.value=eventId;
    const view = route === 'dashboard' ? await dashboardView() : route === 'claims' ? await claimsView() : route === 'settings' ? await settingsView(render) : await moduleView(route,user,render,route==='events'?events:undefined);
    if(version!==renderVersion)return;root.setAttribute('aria-busy','false');
    root.replaceChildren(el('section', { class: 'shell' }, el('aside', { class: 'side' }, brand({link:true}), nav), el('main', { class: 'work',id:'main',tabindex:'-1' }, el('header', { class: 'top' }, selector,el('span',{class:'grow'}),el('span',{class:'account-indicator'},el('span',{},'Signed in as '),el('strong',{},user.username)),theme,logout),el('p',{class:'banner'},'ILLUSTRATIVE DATA · Not real PhilHealth figures or patient data'), view)));
  } catch (error) { if(version!==renderVersion)return;root.setAttribute('aria-busy','false'); if(user && error.message!=='Authentication required.'){root.replaceChildren(el('section',{class:'shell'},el('h1',{},'Unable to load this view'),el('p',{role:'alert'},error.message),el('a',{href:'#dashboard'},'Return to dashboard')));return;} user = null; setCsrfToken(''); root.replaceChildren(loginView(next => { user = next; render(); })); if (error.message !== 'Authentication required.') toast(error.message, 'error'); }
}

window.addEventListener('hashchange', render);
watchDropdowns();
render();

document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();document.querySelector('#main')?.focus();});
