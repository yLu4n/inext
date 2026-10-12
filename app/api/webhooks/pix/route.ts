import { env } from "cloudflare:workers";
import { db, reconcile } from "../../../../lib/server";
import { validSignature } from "../../../../lib/payment";
export async function POST(request:Request) {
 if(!env.MP_WEBHOOK_SECRET || !await validSignature(request,env.MP_WEBHOOK_SECRET)) return new Response("Unauthorized",{status:401});
 const id=new URL(request.url).searchParams.get("data.id");
 const order=await db().prepare("SELECT * FROM orders WHERE payment_id=?").bind(id).first<any>();
 if(order) {try{await reconcile(order);}catch{return new Response("Retry",{status:503});}}
 return new Response("OK");
}
