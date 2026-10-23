export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  node.append(...children.flat().filter(value => value !== null && value !== undefined).map(value =>
    value instanceof Node ? value : document.createTextNode(String(value))));
  return node;
}

export function money(value) {
  return `₱${(Number(value || 0)/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

export function toast(message, kind = 'info') {
  const symbols = { info: 'circle-alert', success: 'circle-check', warning: 'triangle-alert', error: 'octagon-alert' };
  const note = el('p', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, icon(symbols[kind] || symbols.info), el('span', {}, message));
  document.querySelector('#toasts').append(note);
  setTimeout(() => note.remove(), kind === 'error' ? 6000 : 4000);
}

export function themeControl() {
  return el('label', { class: 'theme-control' }, 'Theme', el('select', { name:'theme', 'aria-label': 'Theme', onchange: e => window.philhealthTheme.setChoice(e.target.value) },
    ['automatic','light','dark'].map(value => el('option', { value, selected: window.philhealthTheme.choice === value ? '' : null }, value[0].toUpperCase() + value.slice(1)))));
}
window.addEventListener('phcm-theme-change', () => {
  document.querySelectorAll('select[name="theme"]').forEach(select => {
    if (select.value !== window.philhealthTheme.choice) { select.value = window.philhealthTheme.choice; select.dispatchEvent(new Event('input')); }
  });
});

export function table(headers, rows) {
 let visibleRows=rows;
 let sort=-1,ascending=true,page=0;const size=12;const filter=el('input',{'aria-label':'Filter table',placeholder:'Filter rows…'});const output=el('div');const pageLabel=el('span',{'aria-live':'polite'});
 const previous=el('button',{onclick:()=>{page=Math.max(0,page-1);draw();}},'Previous');const next=el('button',{onclick:()=>{page++;draw();}},'Next');
 function draw(){let data=rows.filter(r=>r.map(c=>c instanceof Node?c.textContent:c).join(' ').toLowerCase().includes(filter.value.toLowerCase()));if(sort>=0)data.sort((a,b)=>String(a[sort] instanceof Node?a[sort].textContent:a[sort]).localeCompare(String(b[sort] instanceof Node?b[sort].textContent:b[sort]),undefined,{numeric:true})*(ascending?1:-1));visibleRows=data;page=Math.min(page,Math.max(0,Math.ceil(data.length/size)-1));
 const head=el('thead',{},el('tr',{},headers.map((h,i)=>el('th',{'aria-sort':sort===i?(ascending?'ascending':'descending'):'none'},el('button',{onclick:()=>{ascending=sort===i?!ascending:true;sort=i;draw();}},h)))));
 const shown=data.slice(page*size,(page+1)*size);output.replaceChildren(el('div',{class:'table-wrap',tabindex:'0','aria-label':'Scrollable data table'},el('table',{},head,el('tbody',{},shown.length?shown.map(r=>el('tr',{},r.map(c=>el('td',{},c)))):el('tr',{},el('td',{colspan:headers.length,class:'empty-state'},filter.value?'No records match your filter. Clear the filter to see all records.':'No records yet.'))))));pageLabel.textContent=`Page ${page+1} · ${data.length} ${data.length===1?'record':'records'}`;previous.disabled=page===0;next.disabled=(page+1)*size>=data.length;
 }filter.addEventListener('input',()=>{page=0;draw();});draw();const download=el('button',{onclick:()=>{const cells=[headers,...visibleRows.map(r=>r.map(c=>c instanceof Node?c.textContent:c))];const csv=cells.map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=el('a',{href:url,download:'illustrative-table.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}},'Export table CSV');return el('section',{},el('div',{class:'toolbar'},filter,download),output,el('div',{class:'pagination','aria-label':'Table pagination'},previous,pageLabel,next));
}
export function icon(name,label){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('focusable','false');
 if(label){svg.setAttribute('role','img');svg.setAttribute('aria-label',label);}else svg.setAttribute('aria-hidden','true');
 const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','/assets/icons.svg#'+name);svg.append(use);return svg;
}
export const badge=s=>el('span',{class:'chip '+s.level},icon(s.icon),s.label);
export function field(label,type='text',value=''){return el('label',{},label,el('input',{name:label,type,value,required:''}));}

// Align modal actions once, keeping submit controls within their original form.
export function alignDialogActions(root) {
 const dialogs=[...(root.matches?.('dialog')?[root]:[]),...root.querySelectorAll('dialog')];
 for(const dialog of dialogs){
  if(dialog.dataset.actionsAligned)continue;
  const form=dialog.querySelector(':scope > form');
  const content=form||dialog.querySelector(':scope > div');
  const buttons=[...dialog.querySelectorAll(':scope > button'),...(content?[...content.children].filter(node=>node.tagName==='BUTTON'):[])];
  if(!buttons.length)continue;
  const group=el('div',{class:'button-group modal-actions'});
  // Keep primary action before Close/Cancel.
  buttons.sort((a,b)=>(/^(Close|Cancel)$/.test(a.textContent)?1:0)-(/^(Close|Cancel)$/.test(b.textContent)?1:0));
  for(const button of buttons){if(/^(Close|Cancel)$/.test(button.textContent))button.type='button';group.append(button);}
  (form||dialog).append(group);dialog.dataset.actionsAligned='true';
 }
}
