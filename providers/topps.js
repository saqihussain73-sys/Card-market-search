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
 const hasWord=(value,words)=>words.some(word=>(" "+String(value).toLowerCase().replace(/[^a-z0-9]+/g," ")+" ").includes(" "+word+" "));
 const boxes=(data.itemSummaries||[]).filter(item=>{
  const name=item.title||"";
  return hasWord(name,["topps"])&&hasWord(name,["box","display","blaster","hobby","value","mega","pack"])&&!hasWord(name,["case","carton","empty","digital","break","replica","custom","single","preorder"])&&item.price?.currency==="GBP"&&Number(item.price.value)>0;
 }).map(item=>({set:key.replace(/^topps/,""),product:item.title,productId:item.itemId,type:hasWord(item.title,["value","blaster","retail","mega"])?"retail":hasWord(item.title,["pack"])&&!hasWord(item.title,["box"])?"pack":"hobby",marketPrice:null,lowPrice:null,listingPriceGBP:Number(item.price.value),listingUrl:item.itemWebUrl,chases:[],releaseDate:null}));
 return {topps:true,status:"active_listings_only",boxes,source:"eBay UK active listings",fetchedAt:new Date().toISOString()};
}
async function ukPrices(product,set){
 if(!process.env.EBAY_CLIENT_ID||!process.env.EBAY_CLIENT_SECRET)return {status:"credentials_required",matchCount:0};
 const bearer=await accessToken();
 const query=[set,product].filter(Boolean).join(" ").slice(0,180);
 const url=new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
 url.searchParams.set("q",query);url.searchParams.set("limit","100");
 url.searchParams.set("filter","buyingOptions:{FIXED_PRICE},conditions:{NEW}");
 const response=await fetch(url,{headers:{Authorization:"Bearer "+bearer,"X-EBAY-C-MARKETPLACE-ID":"EBAY_GB"}});
 if(!response.ok)throw new Error("UK listing lookup failed ("+response.status+")");
 const data=await response.json();
 const words=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean);
 const ignore=new Set(["the","a","and","of","tcg","trading","card","cards","sealed","new","in","hand","box","booster","edition","official","game"]);
 const required=words(product).filter(word=>!ignore.has(word));
 const matches=(data.itemSummaries||[]).filter(item=>{
  const title=" "+words(item.title).join(" ")+" ";
  const has=word=>title.includes(" "+word+" ");
  if(!required.every(has))return false;
  if(["case","carton","empty","break","digital","single","opened","loose","preorder","pre","order"].some(has))return false;
  if(!has("box"))return false;
  if(item.price?.currency!=="GBP"||!(Number(item.price.value)>0))return false;
  return true;
 }).map(item=>{
  const price=Number(item.price.value);
  const shipping=item.shippingOptions||[];
  const costs=shipping.map(option=>option.shippingCost).filter(cost=>cost?.currency==="GBP"&&Number.isFinite(Number(cost.value))).map(cost=>Number(cost.value));
  const delivery=costs.length?Math.min(...costs):null;
  return {priceGBP:price,deliveryGBP:delivery,totalGBP:delivery===null?null:price+delivery,listingUrl:item.itemWebUrl};
 });
 const totals=matches.map(item=>item.totalGBP).filter(Number.isFinite).sort((a,b)=>a-b);
 const median=totals.length?(totals[Math.floor((totals.length-1)/2)]+totals[Math.floor(totals.length/2)])/2:null;
 return {status:"active_listings_only",matchCount:matches.length,deliveryVerifiedCount:totals.length,lowestTotalGBP:totals.length?totals[0]:null,medianTotalGBP:median,lowestAskingGBP:matches.length?Math.min(...matches.map(item=>item.priceGBP)):null,source:"eBay UK active listings",soldPriceGBP:null,fetchedAt:new Date().toISOString()};
}
module.exports={COLLECTIONS,search,ukPrices};
