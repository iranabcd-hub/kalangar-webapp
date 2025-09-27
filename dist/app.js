// app.js — منطق اپ + Lazy-load ECharts + SW update badge
import { db, seedIfEmpty } from './db.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtT = n => new Intl.NumberFormat('fa-IR').format(n|0);
const todayKey = () => new Date().toISOString().slice(0,10);
const state = { user:null, theme:'dark', accent:'warm', geminiKey:null };

/* Utilities */
function setPlan(role){ $('#planBadge').textContent = role==='admin' ? 'Pro' : 'Free' }
function applyTheme(){ document.documentElement.dataset.theme = (state.theme==='light') ? 'light' : '' }
function responsive(){
  const menuBtn = $('#menuBtn'), sidebar = $('#sidebar');
  if (window.innerWidth < 720){
    menuBtn.style.display = 'inline-flex';
    menuBtn.onclick = ()=> sidebar.classList.toggle('show');
  } else {
    menuBtn.style.display = 'none';
    sidebar.classList.remove('show');
  }
}
window.addEventListener('resize', responsive);
$('#themeSel').addEventListener('change', (e)=>{ state.theme = e.target.value; applyTheme(); });

/* Lazy-load a script (for ECharts) */
function ensureScript(src){
  return new Promise((resolve, reject)=>{
    if ([...document.scripts].some(s=> s.src===src)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
async function ensureECharts(){
  if (!window.echarts){
    await ensureScript('https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js');
  }
}

/* Router */
function showView(name){
  $$('aside nav .item').forEach(i => i.classList.toggle('active', i.dataset.route===name));
  $$('main > section').forEach(s => s.classList.toggle('hidden', s.id !== 'view-'+name));
  location.hash = '#/'+name;
  const isPro = state.user?.role==='admin';
  $('#reportsLock')?.classList.toggle('hidden', isPro);
  $('#reportsBody')?.classList.toggle('hidden', !isPro);
  $('#aiLock')?.classList.toggle('hidden', isPro);
  $('#aiBody')?.classList.toggle('hidden', !isPro);

  if (name==='dashboard') renderDashboard();
  if (name==='catalog') renderCatalog();
  if (name==='products') renderProducts();
  if (name==='customers') renderCustomers();
  if (name==='proforma') renderProforma();
  if (name==='orders') renderOrders();
  if (name==='reports' && isPro) renderReports();
  if (name==='public') renderPriceList();
  if (name==='settings') renderSettings();
}
window.addEventListener('hashchange', ()=> showView(location.hash.replace('#/','')||'dashboard'));
$$('aside nav .item').forEach(i=> i.addEventListener('click', ()=> showView(i.dataset.route)));

/* Catalog: Sections & Rules */
let selectedSectionId = null;
async function renderCatalog(){
  const secs = await db.sections.toArray();
  const rules = await db.priceRules.toArray();
  const tbody = $('#sectionsTbody'); tbody.innerHTML='';
  secs.forEach((s,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td>${s.name}</td><td>${s.active?'✓':''}</td>
    <td><button class="btn-sm ghost" data-id="${s.id}">ویرایش قوانین</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      selectedSectionId = btn.dataset.id;
      openRuleEditor(selectedSectionId);
    });
  });
}
$('#addSection').addEventListener('click', async ()=>{
  const name = $('#secName').value.trim(); if(!name) return alert('نام بخش را وارد کنید');
  const id = crypto.randomUUID();
  await db.sections.add({ id, name, active:true });
  await db.priceRules.add({ id: crypto.randomUUID(), sectionId: id, tiers:[], partnerMarkup:0, vatPct:9, rounding:{step:1000,mode:'round'} });
  $('#secName').value=''; renderCatalog();
});
function renderTierRow(t, i){
  return `<div class="row" data-idx="${i}">
    <div><label>min</label><input class="t-min" type="number" value="${t.min??1}"></div>
    <div><label>max</label><input class="t-max" type="number" value="${t.max??''}"></div>
    <div><label>mul</label><input class="t-mul" type="number" step="0.01" value="${t.mul??1}"></div>
    <div><label>add</label><input class="t-add" type="number" value="${t.add??0}"></div>
    <button class="btn-sm ghost rem-tier" type="button">حذف</button>
  </div>`;
}
async function openRuleEditor(sectionId){
  const rule = await db.priceRules.where('sectionId').equals(sectionId).first();
  $('#ruleBox').classList.add('hidden'); $('#ruleForm').classList.remove('hidden');
  $('#partnerMarkup').value = rule?.partnerMarkup ?? 0;
  $('#vatPct').value = rule?.vatPct ?? 9;
  $('#roundStep').value = rule?.rounding?.step ?? 1000;
  $('#roundMode').value = rule?.rounding?.mode ?? 'round';
  const wrap = $('#tiersWrap'); wrap.innerHTML='';
  (rule?.tiers ?? []).forEach((t,i)=>{ const div=document.createElement('div'); div.innerHTML=renderTierRow(t,i); wrap.appendChild(div.firstChild); });
  $('#addTier').onclick = ()=>{
    const i = wrap.children.length;
    const div = document.createElement('div'); div.innerHTML = renderTierRow({min:1,max:'',mul:1,add:0}, i); wrap.appendChild(div.firstChild);
    bindTierRemove();
  };
  bindTierRemove();
  $('#saveRule').onclick = async ()=>{
    const tiers = Array.from(wrap.children).map(row=>{
      const min = +row.querySelector('.t-min').value||1;
      const maxStr = row.querySelector('.t-max').value; const max = maxStr ? +maxStr : undefined;
      const mul = parseFloat(row.querySelector('.t-mul').value)||1;
      const add = +row.querySelector('.t-add').value||0;
      return {min, max, mul, add};
    });
    const partnerMarkup = +$('#partnerMarkup').value||0;
    const vatPct = +$('#vatPct').value||0;
    const rounding = { step: +$('#roundStep').value||1000, mode: $('#roundMode').value };
    if (rule) await db.priceRules.update(rule.id, { tiers, partnerMarkup, vatPct, rounding });
    else await db.priceRules.add({ id: crypto.randomUUID(), sectionId, tiers, partnerMarkup, vatPct, rounding });
    alert('قوانین ذخیره شد.');
  };
}
function bindTierRemove(){ $$('#tiersWrap .rem-tier').forEach(btn=> btn.onclick = ()=> btn.closest('.row')?.remove()); }

/* Products */
let editingProdId = null;
async function renderProducts(){
  const secs = await db.sections.toArray();
  const sel = $('#prodSectionFilter'); sel.innerHTML = '<option value="">همه بخش‌ها</option>' + secs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  const pSel = $('#pSection'); pSel.innerHTML = secs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  const q = $('#prodSearch').value.trim().toLowerCase();
  const filterSec = sel.value;
  let items = await db.products.toArray();
  if (q) items = items.filter(p => (p.name+p.code).toLowerCase().includes(q));
  if (filterSec) items = items.filter(p=>p.sectionId===filterSec);
  const tbody = $('#productsTbody'); tbody.innerHTML='';
  for (let i=0;i<items.length;i++){
    const s = secs.find(x=>x.id===items[i].sectionId)?.name || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${items[i].name}</td><td>${items[i].code||''}</td><td>${s}</td>
    <td>${fmtT(items[i].basePrice)}</td><td>${items[i].unit||''}</td><td>${items[i].stock|0}</td>
    <td><button class="btn-sm ghost edit" data-id="${items[i].id}">ویرایش</button> <button class="btn-sm ghost del" data-id="${items[i].id}">حذف</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('.edit').forEach(b=> b.onclick = ()=> openProdForm(b.dataset.id));
  tbody.querySelectorAll('.del').forEach(b=> b.onclick = async ()=>{ if (confirm('حذف محصول؟')){ await db.products.delete(b.dataset.id); renderProducts(); }});
}
$('#prodSearch').addEventListener('input', renderProducts);
$('#prodSectionFilter').addEventListener('change', renderProducts);
$('#newProdBtn').addEventListener('click', ()=> openProdForm(null));
function openProdForm(id){
  $('#prodFormCard').classList.remove('hidden');
  editingProdId = id;
  $('#prodFormTitle').textContent = id? 'ویرایش محصول' : 'محصول جدید';
  if (!id){
    $('#pName').value=''; $('#pCode').value=''; $('#pBasePrice').value=0; $('#pUnit').value=''; $('#pStock').value=0; $('#pDesc').value='';
  } else {
    db.products.get(id).then(p=>{
      $('#pName').value=p.name; $('#pCode').value=p.code||''; $('#pBasePrice').value=p.basePrice||0; $('#pUnit').value=p.unit||''; $('#pStock').value=p.stock||0; $('#pDesc').value=p.desc||'';
      $('#pSection').value=p.sectionId;
    });
  }
}
$('#cancelProd').onclick = ()=> $('#prodFormCard').classList.add('hidden');
$('#saveProd').onclick = async ()=>{
  const obj = {
    name: $('#pName').value.trim(), code: $('#pCode').value.trim(), sectionId: $('#pSection').value,
    basePrice: +$('#pBasePrice').value||0, unit: $('#pUnit').value.trim(), stock: +$('#pStock').value||0, desc: $('#pDesc').value.trim()
  };
  if (!obj.name || !obj.sectionId) return alert('نام و بخش لازم است');
  if (editingProdId) await db.products.update(editingProdId, obj);
  else await db.products.add({ id: crypto.randomUUID(), ...obj });
  $('#prodFormCard').classList.add('hidden');
  renderProducts();
}

/* Customers */
let editingCustomerId = null;
async function renderCustomers(){
  const tbody = $('#customersTbody'); tbody.innerHTML='';
  const list = await db.customers.toArray();
  for (let i=0;i<list.length;i++){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${list[i].name}</td><td>${list[i].type}</td><td>${list[i].phone||''}</td>
    <td>—</td>
    <td><button class="btn-sm ghost edit" data-id="${list[i].id}">ویرایش</button> <button class="btn-sm ghost del" data-id="${list[i].id}">حذف</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('.edit').forEach(b=> b.onclick = ()=> openCustomerForm(b.dataset.id));
  tbody.querySelectorAll('.del').forEach(b=> b.onclick = async ()=>{ if(confirm('حذف مشتری؟')){ await db.customers.delete(b.dataset.id); renderCustomers(); }});
}
$('#newCustomerBtn').onclick = ()=> openCustomerForm(null);
function openCustomerForm(id){
  $('#custFormCard').classList.remove('hidden');
  editingCustomerId = id;
  $('#custFormTitle').textContent = id? 'ویرایش مشتری' : 'مشتری جدید';
  if (!id){ $('#cName').value=''; $('#cType').value='buyer'; $('#cPhone').value=''; $('#cEmail').value=''; $('#cAddr').value=''; }
  else db.customers.get(id).then(c=>{
    $('#cName').value=c.name; $('#cType').value=c.type; $('#cPhone').value=c.phone||''; $('#cEmail').value=c.email||''; $('#cAddr').value=c.addr||'';
  });
}
$('#cancelCustomer').onclick = ()=> $('#custFormCard').classList.add('hidden');
$('#saveCustomer').onclick = async ()=>{
  const obj = { name: $('#cName').value.trim(), type: $('#cType').value, phone: $('#cPhone').value.trim(), email: $('#cEmail').value.trim(), addr: $('#cAddr').value.trim() };
  if (!obj.name) return alert('نام لازم است');
  if (editingCustomerId) await db.customers.update(editingCustomerId, obj);
  else await db.customers.add({ id: crypto.randomUUID(), ...obj });
  $('#custFormCard').classList.add('hidden'); renderCustomers();
}

/* Pricing helpers */
function roundToStep(v, step, mode='round'){
  const f = v/step; const r = mode==='ceil'? Math.ceil(f): mode==='floor'? Math.floor(f): Math.round(f); return r*step;
}
async function computeUnitPrice(product, qty, priceType='retail'){
  const rule = await db.priceRules.where('sectionId').equals(product.sectionId).first();
  let price = product.basePrice||0;
  if (rule?.tiers?.length){
    const t = rule.tiers.find(t => qty>=t.min && (t.max? qty<=t.max : true));
    if (t){ if (t.mul) price *= t.mul; if (t.add) price += t.add; }
  }
  if (priceType==='partner' && rule?.partnerMarkup){ price += rule.partnerMarkup; }
  if (rule?.rounding) price = roundToStep(price, rule.rounding.step||1000, rule.rounding.mode||'round');
  return { price, vatPct: rule?.vatPct ?? 0 };
}

/* Proforma */
let pf = { id:null, customerId:null, type:'proforma', lines:[], createdAt:Date.now() };
async function renderProforma(){
  const cs = await db.customers.toArray();
  $('#pfCustomer').innerHTML = '<option value="">— انتخاب مشتری —</option>' + cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  drawPfLines();
}
function drawPfLines(){
  const tb = $('#pfLines'); tb.innerHTML='';
  pf.lines.forEach((ln, i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td>
      <td><input class="p-prod" placeholder="نام یا کد..." value="${ln.name||''}" data-i="${i}"></td>
      <td>${ln.unit||''}</td>
      <td><input class="p-qty" type="number" value="${ln.qty||1}" data-i="${i}" style="width:90px"></td>
      <td><input class="p-price" type="number" value="${ln.unitPrice||0}" data-i="${i}" style="width:120px"></td>
      <td><input class="p-disc" type="number" value="${ln.discount||0}" data-i="${i}" style="width:90px"></td>
      <td>${fmtT(ln.total||0)}</td>
      <td><button class="btn-sm ghost p-del" data-i="${i}" type="button">🗑️</button></td>`;
    tb.appendChild(tr);
  });
  const vatPct = pf.vatPct ?? 9;
  const subtotal = pf.lines.reduce((s,l)=> s + (l.qty*l.unitPrice - (l.discount||0)), 0);
  const vat = Math.round(subtotal * (vatPct/100));
  $('#pfSubtotal').textContent = fmtT(subtotal);
  $('#pfVAT').textContent = fmtT(vat);
  $('#pfTotal').textContent = fmtT(subtotal + vat);

  $$('.p-del').forEach(b=> b.onclick = ()=>{ pf.lines.splice(+b.dataset.i,1); drawPfLines(); });
  $$('.p-qty').forEach(inp=> inp.oninput = ()=>{ const i=+inp.dataset.i; pf.lines[i].qty=+inp.value||1; pf.lines[i].total = pf.lines[i].qty*pf.lines[i].unitPrice - (pf.lines[i].discount||0); drawPfLines(); });
  $$('.p-price').forEach(inp=> inp.oninput = ()=>{ const i=+inp.dataset.i; pf.lines[i].unitPrice=+inp.value||0; pf.lines[i].total = pf.lines[i].qty*pf.lines[i].unitPrice - (pf.lines[i].discount||0); drawPfLines(); });
  $$('.p-disc').forEach(inp=> inp.oninput = ()=>{ const i=+inp.dataset.i; pf.lines[i].discount=+inp.value||0; pf.lines[i].total = pf.lines[i].qty*pf.lines[i].unitPrice - (pf.lines[i].discount||0); drawPfLines(); });
  $$('.p-prod').forEach(inp=>{
    inp.onchange = async ()=>{
      const i = +inp.dataset.i;
      const q = inp.value.trim().toLowerCase();
      const prods = await db.products.toArray();
      const p = prods.find(x => (x.name+x.code).toLowerCase().includes(q));
      if (!p) return alert('محصول پیدا نشد');
      const priceType = $('#pfPriceType').value;
      const { price, vatPct } = await computeUnitPrice(p, pf.lines[i].qty||1, priceType);
      pf.vatPct = vatPct;
      pf.lines[i] = { productId: p.id, name:p.name, unit:p.unit||'', qty: pf.lines[i].qty||1, unitPrice: price, discount: pf.lines[i].discount||0, total: 0 };
      pf.lines[i].total = pf.lines[i].qty*pf.lines[i].unitPrice - (pf.lines[i].discount||0);
      drawPfLines();
    };
  });
}
$('#pfAddLine').onclick = ()=>{ pf.lines.push({ name:'', unit:'', qty:1, unitPrice:0, discount:0, total:0 }); drawPfLines(); };
$('#pfSave').onclick = async ()=>{
  const cid = $('#pfCustomer').value; if(!cid) return alert('مشتری را انتخاب کنید');
  if (!pf.lines.length) return alert('حداقل یک ردیف اضافه کنید');
  const subtotal = pf.lines.reduce((s,l)=> s + (l.qty*l.unitPrice - (l.discount||0)), 0);
  const vat = Math.round(subtotal * ((pf.vatPct ?? 9)/100));
  const order = { id: crypto.randomUUID(), type:'proforma', customerId: cid, lines: pf.lines, subtotal, vat, total: subtotal+vat, createdAt: Date.now(), status:'draft' };
  await db.orders.add(order);
  pf = { id:null, customerId:null, type:'proforma', lines:[], createdAt:Date.now(), vatPct: pf.vatPct };
  drawPfLines();
  alert('پیش‌فاکتور ذخیره شد. برای تبدیل به فروش به بخش سفارش‌ها بروید.');
};
$('#pfPrint').onclick = ()=> window.print();

/* Orders */
async function renderOrders(){
  const type = $('#ordType').value;
  const list = (await db.orders.toArray()).filter(o => type==='all' ? true : o.type===type).sort((a,b)=> b.createdAt-a.createdAt);
  const cs = await db.customers.toArray();
  const tbody = $('#ordersTbody'); tbody.innerHTML='';
  list.forEach((o,i)=>{
    const c = cs.find(x=>x.id===o.customerId)?.name || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${o.type}</td><td>${c}</td><td>${new Date(o.createdAt).toLocaleDateString('fa-IR')}</td><td>${fmtT(o.total)}</td><td>${o.status||''}</td>
    <td>
      ${o.type==='proforma' ? '<button class="btn-sm ghost conv" data-id="'+o.id+'">تبدیل به فروش</button>' : ''}
      <button class="btn-sm ghost del" data-id="${o.id}">حذف</button>
    </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.del').forEach(b=> b.onclick = async ()=>{ if(confirm('حذف سند؟')){ await db.orders.delete(b.dataset.id); renderOrders(); }});
  tbody.querySelectorAll('.conv').forEach(b=> b.onclick = ()=> convertToSale(b.dataset.id));
}
$('#ordType').onchange = renderOrders;
async function convertToSale(orderId){
  const o = await db.orders.get(orderId); if (!o) return;
  for (const l of o.lines){
    const p = await db.products.get(l.productId);
    if (!p) return alert('محصول یافت نشد');
    if ((p.stock||0) < l.qty) return alert(`موجودی کافی نیست: ${p.name}`);
  }
  await db.transaction('rw', db.products, db.stockMoves, db.orders, async ()=>{
    for (const l of o.lines){
      const p = await db.products.get(l.productId);
      await db.products.update(p.id, { stock: (p.stock||0) - l.qty });
      await db.stockMoves.add({ id: crypto.randomUUID(), productId: p.id, qty:-l.qty, reason:'sale', refId:o.id, date: Date.now() });
    }
    await db.orders.update(o.id, { type:'sale', status:'confirmed' });
  });
  alert('به فروش تبدیل شد و از موجودی کسر گردید.');
  renderOrders(); renderProducts(); renderDashboard();
}

/* Reports (Pro) */
async function renderReports(){
  await ensureECharts();
  const orders = (await db.orders.where('type').equals('sale').toArray());
  const byDay = {};
  orders.forEach(o=>{
    const d = new Date(o.createdAt).toISOString().slice(0,10);
    byDay[d] = (byDay[d]||0) + (o.total||0);
  });
  const days = Object.keys(byDay).sort();
  const vals = days.map(d=> byDay[d]);
  const el = document.getElementById('chartMonthly');
  const chart = echarts.init(el, null, { renderer:'canvas' });
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip:{ trigger:'axis' }, grid:{ left:30, right:16, top:20, bottom:24 },
    xAxis:{ type:'category', data: days, axisLine:{ lineStyle:{ color:'#64748B' } }, axisLabel:{ color:'#9CA3AF' } },
    yAxis:{ type:'value', axisLine:{ show:false }, splitLine:{ lineStyle:{ color:'rgba(255,255,255,.12)' } }, axisLabel:{ color:'#9CA3AF' } },
    series:[{ type:'bar', data: vals, itemStyle:{ color:'#FF6B3D' }, barWidth: '50%' }]
  });
}

/* Public Price List */
async function renderPriceList(){
  const secs = await db.sections.toArray();
  $('#plSection').innerHTML = secs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
}
$('#plGen').onclick = async ()=>{
  const secId = $('#plSection').value; const kind = $('#plType').value;
  const prods = (await db.products.where('sectionId').equals(secId).toArray());
  const tbody = $('#plTbody'); tbody.innerHTML='';
  for (let i=0;i<prods.length;i++){
    const { price } = await computeUnitPrice(prods[i], 1, kind);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${prods[i].name}</td><td>${prods[i].code||''}</td><td>${prods[i].unit||''}</td><td>${fmtT(price)}</td>`;
    tbody.appendChild(tr);
  }
};
$('#plPrint').onclick = ()=> window.print();

/* Dashboard */
async function renderDashboard(){
  await ensureECharts();
  const salesToday = (await db.orders.where('type').equals('sale').toArray())
    .filter(o=> new Date(o.createdAt).toISOString().slice(0,10)===todayKey())
    .reduce((s,o)=>s+o.total,0);
  $('#kpiSalesToday').textContent = fmtT(salesToday);

  const now = new Date(); const mKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const salesMonth = (await db.orders.where('type').equals('sale').toArray())
    .filter(o=> new Date(o.createdAt).toISOString().slice(0,7)===mKey)
    .reduce((s,o)=>s+o.total,0);
  $('#kpiSalesMonth').textContent = fmtT(salesMonth);

  const lowStock = (await db.products.toArray()).filter(p=> (p.stock||0) < 10).length;
  $('#kpiLowStock').textContent = lowStock;
  $('#kpiDebtors').textContent = '—';

  const el = document.getElementById('chartSales');
  const orders = (await db.orders.where('type').equals('sale').toArray());
  const byDay = {};
  orders.forEach(o=>{ const d=new Date(o.createdAt).toISOString().slice(0,10); byDay[d]=(byDay[d]||0)+o.total; });
  const days = Object.keys(byDay).sort(); const vals = days.map(d=>byDay[d]);
  const chart = echarts.init(el, null, { renderer:'canvas' });
  chart.setOption({
    backgroundColor:'transparent', tooltip:{trigger:'axis'}, grid:{left:30,right:16,top:10,bottom:24},
    xAxis:{type:'category', data:days, axisLine:{lineStyle:{color:'#64748B'}}, axisLabel:{color:'#9CA3AF'}},
    yAxis:{type:'value', splitLine:{lineStyle:{color:'rgba(255,255,255,.12)'}}, axisLabel:{color:'#9CA3AF'}},
    series:[{type:'line', data:vals, smooth:true, lineStyle:{color:'#F43F5E'}, areaStyle:{color:'rgba(244,63,94,.15)'}}]
  });

  const s = await db.settings.get('app'); const b = s?.bizInfo || {};
  $('#bizInfoBrief').textContent = [b.name, b.phone].filter(Boolean).join(' • ');
}

/* Settings & Backup */
async function renderSettings(){
  const s = await db.settings.get('app');
  if (s){ state.theme = s.theme||'dark'; state.accent=s.accent||'warm'; }
  $('#setTheme').value = state.theme; applyTheme();
  const b = s?.bizInfo || {};
  $('#bizName').value = b.name||''; $('#bizPhone').value=b.phone||''; $('#bizAddr').value=b.addr||'';
}
$('#saveBiz').onclick = async ()=>{
  const s = await db.settings.get('app') || { id:'app' };
  s.bizInfo = { name: $('#bizName').value.trim(), phone: $('#bizPhone').value.trim(), addr: $('#bizAddr').value.trim() };
  s.theme = state.theme; s.accent = state.accent;
  await db.settings.put(s); alert('ذخیره شد'); renderDashboard();
};
$('#exportData').onclick = async ()=>{
  const data = {
    sections: await db.sections.toArray(),
    priceRules: await db.priceRules.toArray(),
    products: await db.products.toArray(),
    customers: await db.customers.toArray(),
    orders: await db.orders.toArray(),
    payments: await db.payments.toArray(),
    stockMoves: await db.stockMoves.toArray(),
    settings: await db.settings.toArray()
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kalangar-backup.json'; a.click();
};
$('#importData').onclick = ()=> $('#importFile').click();
$('#importFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if (!file) return;
  const txt = await file.text(); const data = JSON.parse(txt);
  await db.transaction('rw', db.sections, db.priceRules, db.products, db.customers, db.orders, db.payments, db.stockMoves, db.settings, async ()=>{
    await db.sections.clear(); await db.priceRules.clear(); await db.products.clear(); await db.customers.clear();
    await db.orders.clear(); await db.payments.clear(); await db.stockMoves.clear(); await db.settings.clear();
    await db.sections.bulkAdd(data.sections||[]); await db.priceRules.bulkAdd(data.priceRules||[]);
    await db.products.bulkAdd(data.products||[]); await db.customers.bulkAdd(data.customers||[]);
    await db.orders.bulkAdd(data.orders||[]); await db.payments.bulkAdd(data.payments||[]);
    await db.stockMoves.bulkAdd(data.stockMoves||[]); await db.settings.bulkAdd(data.settings||[]);
  });
  alert('بازیابی انجام شد'); showView('dashboard');
});

/* AI Advisor (Gemini) */
$('#aiAsk').onclick = async ()=>{
  if (state.user?.role!=='admin') return alert('مخصوص Pro');
  const key = $('#geminiKey').value.trim() || state.geminiKey;
  if (!key) return alert('کلید API لازم است');
  state.geminiKey = key;
  const prompt = $('#aiPrompt').value.trim(); if (!prompt) return;
  $('#aiAnswer').textContent = 'در حال دریافت پاسخ...';
  try{
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{ role:'user', parts:[{text: prompt}]}] }) });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || 'پاسخی دریافت نشد.';
    $('#aiAnswer').textContent = text;
  }catch(e){ $('#aiAnswer').textContent = 'خطا در ارتباط با سرویس.'; }
};

/* Login */
$('#loginDemo').onclick = async ()=>{ state.user = { role:'demo' }; setPlan('demo'); $('#loginOverlay').classList.add('hidden'); await seedIfEmpty(); startApp(); };
$('#loginAdmin').onclick = async ()=>{ state.user = { role:'admin' }; setPlan('admin'); $('#loginOverlay').classList.add('hidden'); await seedIfEmpty(); startApp(); };

/* SW + Update */
async function initSW(){
  if (!('serviceWorker' in navigator)) return;
  try{
    const reg = await navigator.serviceWorker.register('./sw.js');
    if (reg.waiting){ $('#updateBadge').classList.remove('hidden'); $('#updateBadge').onclick = ()=> reg.waiting.postMessage({type:'SKIP_WAITING'}); }
    reg.addEventListener('updatefound', ()=>{
      const sw = reg.installing;
      sw?.addEventListener('statechange', ()=>{
        if (sw.state==='installed' && navigator.serviceWorker.controller){
          $('#updateBadge').classList.remove('hidden');
          $('#updateBadge').onclick = ()=> sw.postMessage({type:'SKIP_WAITING'});
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', ()=> location.reload());
  }catch(e){ console.warn('SW register failed', e); }
}

/* Start */
async function startApp(){
  responsive(); applyTheme();
  const s = await db.settings.get('app'); const b = s?.bizInfo || {};
  $('#bizInfoBrief').textContent = [b.name, b.phone].filter(Boolean).join(' • ');
  showView((location.hash.replace('#/','')) || 'dashboard');
  initSW();
}

/* Initial */
responsive();
