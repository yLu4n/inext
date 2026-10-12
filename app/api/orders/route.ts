import { env } from "cloudflare:workers";
import { db, identity, failure, mp, reconcile, sameOrigin, config } from "../../../lib/server";
import { z } from "zod";
import { reservationStatements } from "../../../lib/inventory";
const checkout=z.object({requestKey:z.string().uuid(),items:z.array(z.object({id:z.string().min(1),quantity:z.number().int().min(1).max(5)})).min(1).max(10)});
export async function GET(request:Request) {
 try {
  const user=await identity(), id=new URL(request.url).searchParams.get("id");
  if(!id) {const orders=await db().prepare("SELECT id,items,total,status,created_at,delivered_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.userId).all(); return Response.json(orders.results);}
  let o=await db().prepare("SELECT * FROM orders WHERE id=? AND user_id=?").bind(id,user.userId).first<any>();
  if(!o) return Response.json({error:"Pedido não encontrado."},{status:404});
  if(o.payment_id && !["rejected","cancelled","refunded","charged_back"].includes(o.status)) {await reconcile(o); o=await db().prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>();}
  const keys=o.status==="approved" && o.delivered_at ? (await db().prepare("SELECT k.code,p.name FROM keys k JOIN products p ON p.id=k.product_id WHERE k.order_id=?").bind(id).all()).results : [];
  return Response.json({...o,keys,settings:await config()});
 }catch(e){return failure(e);}
}
export async function POST(request:Request) {
 try {
  sameOrigin(request); const user=await identity();
  if(!env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET || !env.SITE_URL) throw new Error("Pix ainda não configurado. Nenhuma cobrança foi realizada.");
  const body=checkout.parse(await request.json());
  if(new Set(body.items.map(i=>i.id)).size!==body.items.length) throw new Error("Produtos duplicados.");
  const requestKey=`${user.userId}:${body.requestKey}`;
  let order=await db().prepare("SELECT * FROM orders WHERE request_key=?").bind(requestKey).first<any>();
  if(!order) {
   const products=await Promise.all(body.items.map(i=>db().prepare("SELECT * FROM products WHERE id=? AND active=1 AND deleted=0").bind(i.id).first<any>()));
   if(products.some(p=>!p)) throw new Error("Produto indisponível.");
   const items=products.map((p,i)=>({id:p.id,name:p.name,price:p.price,quantity:body.items[i].quantity,automatic:p.automatic}));
   const total=items.reduce((sum,i)=>sum+i.price*i.quantity,0),id=crypto.randomUUID();
   await db().batch(reservationStatements({id,userId:user.userId,email:user.email,requestKey,createdAt:Date.now(),items}).map(s=>db().prepare(s.sql).bind(...s.values)));
   order=await db().prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>();
   if(!order) throw new Error("Estoque insuficiente. Atualize o catálogo e tente novamente.");
  }
  if(!order.payment_id) {
   const p=await mp("/v1/payments",{method:"POST",headers:{"X-Idempotency-Key":order.id},body:JSON.stringify({transaction_amount:order.total/100,description:"INEXT — Keys digitais",payment_method_id:"pix",payer:{email:order.email},external_reference:order.id,date_of_expiration:new Date(order.created_at+30*60*1000).toISOString(),notification_url:`${env.SITE_URL.replace(/\/$/,"")}/api/webhooks/pix`})});
   if(!p.id || !p.point_of_interaction?.transaction_data?.qr_code) throw new Error("O provedor não retornou o código Pix. Tente novamente usando o mesmo pedido.");
   await db().prepare("UPDATE orders SET payment_id=?,status='pending',qr=?,qr_image=? WHERE id=?").bind(String(p.id),p.point_of_interaction.transaction_data.qr_code,p.point_of_interaction.transaction_data.qr_code_base64 || "",order.id).run();
  }
  return Response.json({id:order.id});
 }catch(e){return failure(e);}
}
