import { brand } from '../brand.js?v=3d-20261023';
import { api, setCsrfToken } from '../api.js';
import { el, toast } from '../ui.js';

export function loginView(onLogin) {
  const username = el('input', { name: 'username', autocomplete: 'username', required: '' });
  const password = el('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: '' });
  const form = el('form', { class: 'card' }, brand({login:true}), el('h1', {}, 'Calamity Claims Monitor'),
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
