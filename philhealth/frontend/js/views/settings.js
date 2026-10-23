import { api } from '../api.js';
import { el, table, toast } from '../ui.js';

const labels = {warning_pct:'Warning utilization (%)',danger_pct:'Danger utilization (%)',critical_pct:'Critical utilization (%)',aging_days:'Aging threshold (days)',as_of_date:'Reporting as-of date',z_threshold:'Unusual amount z-score threshold',filing_deadline_days:'Filing deadline (days)'};
function row(setting, reload) {
  const label=labels[setting.key]||setting.key;
  const value = el('input', { value: setting.value, 'aria-label': `${label} value` });
  const reason = el('input', { placeholder: 'Reason for change', 'aria-label': `${label} reason` });
  const save = el('button', {
    class: 'primary',
    onclick: async () => {
      try {
        await api(`/settings/${encodeURIComponent(setting.key)}`, {
          method: 'PUT', body: JSON.stringify({ value: value.value, reason: reason.value })
        });
        toast(`${label} updated.`); reload();
      } catch (error) { toast(error.message, 'error'); }
    }
  }, 'Save');
  return [label, value, reason, save];
}

export async function settingsView(reload) {
  const settings = await api('/settings');
  return el('section', {}, el('h1', {}, 'Administration'),
    el('p', { class: 'intro' }, 'Update monitoring thresholds and the reporting as-of date. Every change requires a reason and is audited.'),
    table(['Setting', 'Value', 'Reason', ''], settings.map(setting => row(setting, reload))));
}
