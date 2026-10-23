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

export function toast(message) {
  const note = el('p', { class: 'toast' }, message);
  document.querySelector('#toasts').append(note);
  setTimeout(() => note.remove(), 3200);
}

export function table(headers, rows) {
 let sort=-1,ascending=true,page=0;const size=12;const filter=el('input',{'aria-label':'Filter table',placeholder:'Filter rows…'});const output=el('div');const pageLabel=el('span',{'aria-live':'polite'});
 const previous=el('button',{onclick:()=>{page=Math.max(0,page-1);draw();}},'Previous');const next=el('button',{onclick:()=>{page++;draw();}},'Next');
 function draw(){let data=rows.filter(r=>r.map(c=>c instanceof Node?c.textContent:c).join(' ').toLowerCase().includes(filter.value.toLowerCase()));if(sort>=0)data.sort((a,b)=>String(a[sort] instanceof Node?a[sort].textContent:a[sort]).localeCompare(String(b[sort] instanceof Node?b[sort].textContent:b[sort]),undefined,{numeric:true})*(ascending?1:-1));page=Math.min(page,Math.max(0,Math.ceil(data.length/size)-1));
 const head=el('thead',{},el('tr',{},headers.map((h,i)=>el('th',{'aria-sort':sort===i?(ascending?'ascending':'descending'):'none'},el('button',{onclick:()=>{ascending=sort===i?!ascending:true;sort=i;draw();}},h)))));
 const shown=data.slice(page*size,(page+1)*size);output.replaceChildren(el('div',{class:'table-wrap',tabindex:'0','aria-label':'Scrollable data table'},el('table',{},head,el('tbody',{},shown.length?shown.map(r=>el('tr',{},r.map(c=>el('td',{},c)))):el('tr',{},el('td',{colspan:headers.length},'No records match.'))))));pageLabel.textContent=`Page ${page+1} · ${data.length} records`;previous.disabled=page===0;next.disabled=(page+1)*size>=data.length;
 }filter.addEventListener('input',()=>{page=0;draw();});draw();return el('section',{},el('div',{class:'toolbar'},filter),output,el('div',{class:'toolbar'},previous,pageLabel,next));
}
export const badge=s=>el('span',{class:'chip '+s.level},`${s.icon} ${s.label}`);
export function field(label,type='text',value=''){return el('label',{},label,el('input',{name:label,type,value,required:''}));}
