const express = require("express");
const path = require("path");
const tcgcsv = require("./providers/tcgcsv");
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, "public")));
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await tcgcsv.listCategories();
    res.json(categories.map(c => ({categoryId:c.categoryId,name:c.name})));
  } catch (err) { console.error(err); res.status(502).json({error:err.message}); }
});
app.get("/api/compare-boxes", async (req, res) => {
  try { res.json(await tcgcsv.compareBoxes(req.query.game || "riftbound")); }
  catch (err) { console.error(err); res.status(502).json({error:err.message}); }
});
app.get("/api/games", (req,res)=>res.json(tcgcsv.GAME_NAMES));
app.get("/api/game/:key",async(req,res)=>{
 try{res.json(await tcgcsv.getGameBoxes(req.params.key));}
 catch(err){console.error(err);res.status(502).json({error:err.message});}
});

const cardEmpireCache=new Map();
const CE_TTL=6*60*60*1000;
function normaliseTitle(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function matchCardEmpire(item,game,box){
 const title=normaliseTitle(item.title), target=normaliseTitle(box.product), set=normaliseTitle(box.set);
 const gameTokens={pokemon:["pokemon","pok mon"],yugioh:["yu gi oh","yugioh"]}[game];
 if(!gameTokens || !gameTokens.some(token=>title.includes(token)))return false;
 if(!set || !title.includes(set))return false;
 const type=box.type||"booster";
 const types={booster:/\b(?:booster box|booster display|display box)\b/,etb:/\b(?:elite trainer box|etb)\b/,tin:/\btins?\b/,bundle:/\b(?:bundle|collection)\b/,deck:/\b(?:starter|structure|theme|trial) deck\b/};
 if(!types[type]?.test(title) || /\b(?:case|carton|single pack|loose pack)\b/.test(title))return false;
 const critical=target.split(" ").filter(token=>token.length>2&&!["pokemon","booster","box","display","english","japanese","sealed","the","with"].includes(token));
 if(!critical.every(token=>title.split(" ").includes(token)))return false;
 for(const language of ["english","japanese"]){
  if(target.includes(language)&&!title.includes(language))return false;
  if(title.includes(language)&&target.includes(language==="english"?"japanese":"english"))return false;
 }
 return true;
}
app.get("/api/retail/card-empire",async(req,res)=>{
 const game=String(req.query.game||""),product=String(req.query.product||""),set=String(req.query.set||""),type=String(req.query.type||"booster");
 const debug=req.query.debug==="1";
 if(!["pokemon","yugioh"].includes(game)||!product||!set||product.length>180||set.length>120)
  return res.json({offer:null,...(debug?{diagnostics:{status:"invalid_input"}}:{})});
 const key=JSON.stringify([game,product,set,type]),cached=cardEmpireCache.get(key);
 if(!debug&&cached&&Date.now()-cached.at<CE_TTL)return res.json(cached.data);
 const queries=[product,set+" "+(type==="etb"?"elite trainer box":type==="booster"?"booster box":type)];
 const diagnostics={status:"searching",searches:[],returned:0,candidates:[]};
 const seen=new Map();
 for(const q of queries){
  try{
   const url="https://www.cardempire.com/search/suggest.json?"+new URLSearchParams({q,"resources[type]":"product","resources[limit]":"10"});
   const response=await fetch(url,{headers:{"User-Agent":"CardMarketSearch/1.0"},signal:AbortSignal.timeout(8000)});
   if(!response.ok){diagnostics.searches.push({query:q,status:"http_error",httpStatus:response.status});continue;}
   const data=await response.json();
   if(!Array.isArray(data.resources?.results?.products)){diagnostics.searches.push({query:q,status:"unexpected_response"});continue;}
   const items=data.resources.results.products;
   diagnostics.searches.push({query:q,status:"ok",count:items.length});
   for(const item of items)seen.set(String(item.id||item.url||item.title),item);
  }catch(err){diagnostics.searches.push({query:q,status:err.name==="TimeoutError"?"timeout":"request_error"});console.warn("Card Empire lookup:",err.message);}
 }
 const products=[...seen.values()];diagnostics.returned=products.length;
 const matches=[];
 for(const item of products){
  const reasons=[];
  if(!matchCardEmpire(item,game,{product,set,type}))reasons.push("Game, set, product name, language or product type does not match");
  const price=Number(item.price);
  if(!Number.isFinite(price)||price<=0)reasons.push("No usable positive price");
  let url;
  try{url=new URL(item.url||"","https://www.cardempire.com");if(url.hostname!=="www.cardempire.com"||!url.pathname.startsWith("/products/"))reasons.push("Not a direct Card Empire product URL");}
  catch{reasons.push("Invalid product URL");}
  if(debug)diagnostics.candidates.push({title:String(item.title||"").slice(0,180),reasons:reasons.length?reasons:["matched"]});
  if(!reasons.length)matches.push({name:item.title,priceGBP:price,url:url.href});
 }
 diagnostics.status=diagnostics.searches.every(x=>x.status!=="ok")?"search_failed":products.length===0?"no_search_results":matches.length===1?"matched":matches.length>1?"ambiguous_matches":"no_exact_match";
 const result={offer:matches.length===1?matches[0]:null};
 if(!debug)cardEmpireCache.set(key,{at:Date.now(),data:result});
 res.json(debug?{...result,diagnostics}:result);
});

app.get("/health", (req,res) => res.json({ok:true}));
app.listen(PORT, () => {
 console.log(`Card Market Search listening on ${PORT}`);
 // Warm smaller catalogues first. Larger scans run only after these finish.
 setTimeout(async()=>{
  for(const game of ["riftbound","gundam","lorcana","starwars","unionarena","onepiece","pokemon","magic"]){
   try{await tcgcsv.getGameBoxes(game);console.log("Cache ready:",game);}
   catch(err){console.warn("Cache warmup skipped:",game,err.message);}
  }
 },3000);
});
