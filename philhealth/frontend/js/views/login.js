import { api, setCsrfToken } from '../api.js';
import { el, toast, themeControl } from '../ui.js';

export function loginView(onLogin) {
  const username = el('input', { name: 'username', autocomplete: 'username', required: '' });
  const password = el('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: '' });
  const form = el('form', { class: 'card' }, el('img',{src:'/assets/philhealth-logo.png',alt:'PhilHealth',width:'1920',height:'703'}), el('h1', {}, 'Calamity Claims Monitor'), el('p', { class: 'intro' }, 'Illustrative local demo · cfb / demo1234'), themeControl(),
    el('label', {}, 'Username', username), el('label', {}, 'Password', password), el('button', { class: 'primary', type: 'submit' }, 'Log in'));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify({ username: username.value, password: password.value }) });
      setCsrfToken(result.csrfToken); onLogin(result.user);
    } catch (error) { toast(error.message, 'error'); }
  });
  return el('section', { class: 'login' }, form);
}
