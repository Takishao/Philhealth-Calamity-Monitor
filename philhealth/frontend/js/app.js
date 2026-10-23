import { api, setCsrfToken } from './api.js';
import { el, toast } from './ui.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { claimsView } from './views/claims.js';
import { settingsView } from './views/settings.js';

import { eventId,setEvent } from './context.js';
import { moduleView } from './views/modules.js';
const root = document.querySelector('#app');
let user;
const pages = [['events','Events & budgets',['CFB','EXE','AUD']],['requests','Provider requests',['CFB','EXE','ROS','RVP','AUD']],['dashboard', 'Dashboard', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['claims', 'Claims', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['exceptions', 'Exceptions', ['CFB', 'ROS', 'ACT']], ['analytics', 'Analytics', ['CFB', 'EXE']], ['reports', 'Reports', ['CFB', 'ROS', 'RVP', 'EXE', 'AUD', 'ACT']], ['audit', 'Audit trail', ['AUD', 'CFB']], ['settings', 'Admin', ['ADM']]];


async function render() {
  try {
    if (!user) { const session = await api('/me'); user = session.user; setCsrfToken(session.csrfToken); }
    let route = location.hash.slice(1) || 'dashboard';
    const permitted = pages.filter(page => page[2].includes(user.role));
    if (!permitted.some(page => page[0] === route)) {
      route = permitted[0][0];
      history.replaceState(null, '', `#${route}`);
    }
    const nav = el('nav', { class: 'nav' }, pages.filter(page => page[2].includes(user.role)).map(page => el('a', { href: `#${page[0]}`, class: route === page[0] ? 'active' : '' }, page[1])));
    const logout = el('button', { class: 'primary', onclick: async () => { try { await api('/logout', { method: 'POST' }); user = null; setCsrfToken(''); render(); } catch (error) { toast(error.message); } } }, 'Log out');
    const events=await api('/events');if(!events.some(e=>e.id===eventId)&&events.length)setEvent(events[0].id);
    const selector=el('select',{'aria-label':'Selected event',onchange:e=>{setEvent(e.target.value);render();}},events.map(e=>el('option',{value:e.id,selected:e.id===eventId?'':null},e.name)));
    selector.value=eventId;
    const view = route === 'dashboard' ? await dashboardView() : route === 'claims' ? await claimsView() : route === 'settings' ? await settingsView(render) : await moduleView(route,user,render);
    root.replaceChildren(el('section', { class: 'shell' }, el('aside', { class: 'side' }, el('a',{href:'#dashboard',class:'brand'},el('img',{src:'/assets/philhealth-seal.png',alt:'PhilHealth',width:'165',height:'61'})), nav), el('main', { class: 'work',id:'main',tabindex:'-1' }, el('header', { class: 'top' }, el('label',{},'Event ',selector),el('span',{class:'grow'}),`${user.username} · ${user.role}`,logout),el('p',{class:'banner'},'ILLUSTRATIVE DATA · Not real PhilHealth figures or patient data'), view)));
  } catch (error) { if(user && error.message!=='Authentication required.'){root.replaceChildren(el('section',{class:'shell'},el('h1',{},'Unable to load this view'),el('p',{role:'alert'},error.message),el('a',{href:'#dashboard'},'Return to dashboard')));return;} user = null; setCsrfToken(''); root.replaceChildren(loginView(next => { user = next; render(); })); if (error.message !== 'Authentication required.') toast(error.message); }
}

window.addEventListener('hashchange', render);
render();
