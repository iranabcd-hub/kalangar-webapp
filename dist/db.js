// db.js
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.7/dist/dexie.mjs';

export const db = new Dexie('kalangar');
db.version(1).stores({
  sections: 'id,name,active',
  priceRules: 'id,sectionId',
  products: 'id,sectionId,categoryId,name,code',
  customers: 'id,name,type,phone',
  orders: 'id,type,customerId,createdAt',
  payments: 'id,customerId,date',
  stockMoves: 'id,productId,date',
  settings: 'id'
});

export async function seedIfEmpty(){
  const count = await db.products.count();
  if (count>0) return;
  const secId = crypto.randomUUID();
  await db.sections.add({ id: secId, name:'افزودنی‌های شیمیایی', active:true });
  await db.priceRules.add({
    id: crypto.randomUUID(), sectionId: secId,
    tiers: [{min:1,max:9,mul:1.2},{min:10,max:49,mul:1.1},{min:50, mul:1.0}],
    partnerMarkup: 0, vatPct: 9, rounding:{step:1000, mode:'round'}
  });
  const prods = [
    { name:'روان‌کننده سوپر', code:'SP-01', unit:'کیلو', basePrice: 95000, stock: 120 },
    { name:'واترپروف مایع', code:'WP-10', unit:'لیتر', basePrice: 120000, stock: 80 },
    { name:'بتن اکسپوز A', code:'EX-A', unit:'کیلو', basePrice: 180000, stock: 60 }
  ];
  for (const p of prods){
    await db.products.add({ id: crypto.randomUUID(), sectionId: secId, name:p.name, code:p.code, unit:p.unit, basePrice:p.basePrice, stock:p.stock, desc:'' });
  }
  await db.customers.bulkAdd([
    { id: crypto.randomUUID(), name:'شرکت سازه نوین', type:'buyer', phone:'021-xxxxxxx', email:'', addr:'تهران' },
    { id: crypto.randomUUID(), name:'فروشگاه مصالح آراد', type:'both', phone:'0912xxxxxxx', email:'', addr:'اصفهان' }
  ]);
  await db.settings.put({ id:'app', theme:'dark', accent:'warm', bizInfo:{name:'کالانگار',phone:'',addr:''}});
}