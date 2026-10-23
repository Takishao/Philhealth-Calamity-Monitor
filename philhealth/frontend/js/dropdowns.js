// Keep native select values/change events as the source of truth for existing forms.
// The shared popover supplies consistent, keyboard-accessible menu styling on every OS.
import { el, icon, alignDialogActions } from './ui.js';
let nextId = 0;
const controls = new Set();
export function enhanceDropdowns(root = document) {
  alignDialogActions(root);
  root.querySelectorAll('select:not([data-enhanced])').forEach(select => {
    select.dataset.enhanced = 'true';
    const id = `dropdown-${++nextId}`;
    const label = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent.trim() || 'Choose an option';
    const text = el('span', { class: 'dropdown-value' });
    const trigger = el('button', { type: 'button', class: 'dropdown-trigger', role: 'combobox', 'aria-label': label, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': id }, text, icon('chevron-down'));
    const panel = el('div', { id, class: 'dropdown-panel', popover: 'auto', role: 'listbox', 'aria-label': label });
    const scroll = el('div', { class: 'dropdown-scroll' });
    panel.append(scroll);
    const wrapper = el('span', { class: 'dropdown' });
    select.before(wrapper); wrapper.append(select, trigger, panel);
    select.hidden = true;
    function sync() {
      text.textContent = select.selectedOptions[0]?.textContent || 'No options available';
      trigger.disabled = select.disabled || !select.options.length;
      scroll.replaceChildren(...[...select.options].map((option, index) => el('button', {
        type: 'button', class: 'dropdown-option', role: 'option', tabindex: '-1', 'aria-selected': String(index === select.selectedIndex),
        disabled: option.disabled ? '' : null,
        onclick: () => { select.selectedIndex = index; panel.hidePopover(); sync(); trigger.focus(); select.dispatchEvent(new Event('change', { bubbles: true })); }
      }, option.textContent)));
    }
    function position() {
      if (!panel.matches(':popover-open') || !trigger.isConnected) return;
      const box = trigger.getBoundingClientRect(), gap = 8;
      const height = Math.min(scroll.scrollHeight, 320, window.innerHeight - gap * 2 - 2);
      const width = Math.min(Math.max(box.width, 180), window.innerWidth - gap * 2);
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(gap, Math.min(box.left, window.innerWidth - width - gap))}px`;
      panel.style.top = `${Math.max(gap, box.bottom + height + 2 + gap > window.innerHeight ? box.top - height - 2 - gap : box.bottom + gap)}px`;
      scroll.style.maxHeight = `${height}px`;
    }
    function open() { panel.showPopover(); trigger.setAttribute('aria-expanded', 'true'); position(); scroll.children[select.selectedIndex]?.focus({ preventScroll: true }); }
    trigger.addEventListener('click', () => panel.matches(':popover-open') ? panel.hidePopover() : open());
    trigger.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); open(); if (event.key === 'Home') scroll.firstElementChild?.focus(); if (event.key === 'End') scroll.lastElementChild?.focus(); } });
    panel.addEventListener('keydown', event => {
      const options = [...scroll.children].filter(option => !option.disabled), index = options.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      } else if (event.key === 'Escape') { event.preventDefault(); panel.hidePopover(); trigger.focus(); }
      else if (event.key === 'Tab') { panel.hidePopover(); trigger.focus(); }
      else if (event.key.length === 1 && event.key !== ' ') { const match = options.find(option => option.textContent.toLowerCase().startsWith(event.key.toLowerCase())); match?.focus(); }
    });
    panel.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open'))));
    select.addEventListener('change', sync);
    select.addEventListener('input', sync);
    select.labels?.forEach(label => label.addEventListener('click', event => { if (event.target === label) { event.preventDefault(); trigger.focus(); } }));
    sync(); controls.add({ trigger, panel, position });
  });
}
function reposition() { for (const control of controls) { if (!control.trigger.isConnected) { controls.delete(control); } else control.position(); } }
window.addEventListener('resize', reposition);
document.addEventListener('scroll', reposition, true);
export function watchDropdowns() {
  enhanceDropdowns();
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('select:not([data-enhanced])')) enhanceDropdowns(node.parentElement);
      else enhanceDropdowns(node);
    }
    reposition();
  }).observe(document.body, { childList: true, subtree: true });
}
