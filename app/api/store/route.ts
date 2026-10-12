import { identity, db, config, failure } from "../../../lib/server";
import { env } from "cloudflare:workers";
import { samples } from "../../../lib/catalog";
export async function GET() {
 try {
  const result=await db().prepare("SELECT p.*, (SELECT COUNT(*) FROM keys k WHERE k.product_id=p.id AND k.order_id IS NULL) stock FROM products p WHERE deleted=0 AND active=1").all();
  const count=await db().prepare("SELECT COUNT(*) count FROM products WHERE deleted=0").first<any>();
  let user=null; try {user=await identity();}catch{}
  return Response.json({products:count.count===0?samples:result.results,demo:count.count===0,settings:await config(),pixReady:!!(env.MP_ACCESS_TOKEN && env.MP_WEBHOOK_SECRET && env.SITE_URL),user:user?{email:user.email,name:user.displayName}:null});
 }catch(e){return failure(e);}
}
