// Optional eBay UK Browse API adapter. Requires EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.
const COLLECTIONS={toppsspongebob:"Topps Chrome SpongeBob SquarePants sealed box",toppsstarwars:"Topps Star Wars sealed hobby box",toppsmarvel:"Topps Marvel sealed hobby box",toppsdisney:"Topps Disney sealed hobby box",toppswwe:"Topps WWE sealed hobby box",toppsgpk:"Topps Garbage Pail Kids sealed box",toppssoccer:"Topps football soccer sealed hobby box",toppsbasketball:"Topps basketball sealed hobby box",toppsamericanfootball:"Topps NFL sealed hobby box",toppsbaseball:"Topps baseball sealed hobby box",toppsf1:"Topps Formula 1 sealed hobby box",toppsufc:"Topps UFC sealed hobby box",toppshockey:"Topps hockey sealed box",toppsboxing:"Topps boxing sealed hobby box",toppstennis:"Topps tennis sealed hobby box",toppsgolf:"Topps golf sealed hobby box",toppscricket:"Topps cricket sealed box",toppsracing:"Topps motorsport sealed hobby box"};
let token,expires=0;
async function accessToken(){
 if(token&&Date.now()<expires)return token;
 const credentials=Buffer.from(process.env.EBAY_CLIENT_ID+":"+process.env.EBAY_CLIENT_SECRET).toString("base64");
 const response=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+credentials,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope"});
 if(!response.ok)throw new Error("eBay authentication failed ("+response.status+")");
 const value=await response.json();token=value.access_token;expires=Date.now()+Math.max(0,value.expires_in-120)*1000;return token;
}
async function search(key){
 if(!Object.hasOwn(COLLECTIONS,key))return null;
 if(!process.env.EBAY_CLIENT_ID||!process.env.EBAY_CLIENT_SECRET)return {topps:true,status:"credentials_required",boxes:[]};
 const bearer=await accessToken();
 const url=new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
 url.searchParams.set("q",COLLECTIONS[key]);url.searchParams.set("limit","50");url.searchParams.set("filter","buyingOptions:{FIXED_PRICE},conditions:{NEW}");
 const response=await fetch(url,{headers:{Authorization:"Bearer "+bearer,"X-EBAY-C-MARKETPLACE-ID":"EBAY_GB"}});
 if(!response.ok)throw new Error("eBay search unavailable ("+response.status+")");
 const data=await response.json();
 const boxes=(data.itemSummaries||[]).filter(item=>{
  const name=item.title||"";
  return /\\btopps\\b/i.test(name)&&/\\b(box|display|blaster|hobby|value|mega|pack)\\b/i.test(name)&&!/\\b(case|carton|empty|digital|break|replica|custom|single|loose cards|preorder)\\b/i.test(name)&&item.price?.currency==="GBP"&&Number(item.price.value)>0;
 }).map(item=>({set:key.replace(/^topps/,""),product:item.title,productId:item.itemId,type:/\\b(value|blaster|retail|mega)\\b/i.test(item.title)?"retail":/\\bpack\\b/i.test(item.title)&&!/\\bbox\\b/i.test(item.title)?"pack":"hobby",marketPrice:null,lowPrice:null,listingPriceGBP:Number(item.price.value),listingUrl:item.itemWebUrl,chases:[],releaseDate:null}));
 return {topps:true,status:"active_listings_only",boxes,source:"eBay UK active listings",fetchedAt:new Date().toISOString()};
}
module.exports={COLLECTIONS,search};
