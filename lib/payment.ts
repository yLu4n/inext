export function paymentMatches(order: any, payment: any) {
 return payment.external_reference === order.id && payment.currency_id === "BRL" && payment.payment_method_id === "pix" && Math.round(Number(payment.transaction_amount)*100) === order.total;
}
export async function validSignature(request: Request, secret: string) {
 const url = new URL(request.url), id=url.searchParams.get("data.id")?.toLowerCase(), rid=request.headers.get("x-request-id");
 const signature = Object.fromEntries((request.headers.get("x-signature") || "").split(",").map(p=>p.trim().split("=")));
 if(!id || !rid || !signature.ts || !/^[0-9a-f]{64}$/.test(signature.v1 || "")) return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=new Uint8Array(signature.v1.match(/../g)!.map((v:string)=>parseInt(v,16)));
 return crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(`id:${id};request-id:${rid};ts:${signature.ts};`));
}
