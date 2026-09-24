const express = require("express");
const path = require("path");
const fs = require("fs");
const tcgcsv = require("./providers/tcgcsv");
const topps = require("./providers/topps");
const officialTopps = require("./providers/topps-official");
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
app.get("/api/uk-prices",async(req,res)=>{try{if(!req.query.product)return res.status(400).json({error:"Product required"});res.json(await topps.ukPrices(String(req.query.product).slice(0,200),String(req.query.set||"").slice(0,120)));}catch(error){console.error("UK prices:",error.message);res.status(502).json({error:"UK listing search unavailable"});}});
app.get("/api/topps/:key",async(req,res)=>{try{const data=officialTopps.get(req.params.key);if(!data)return res.status(404).json({error:"Unknown Topps collection"});res.json(data);}catch(error){console.error("Topps source:",error.message);res.status(502).json({error:error.message});}});
app.get("/api/games", (req,res)=>res.json(tcgcsv.GAME_NAMES));
const cacheDir=process.env.CACHE_DIR||path.join(__dirname,".scan-cache");
const gameJobs=new Map();
function cachePath(key){return path.join(cacheDir,key+".json");}
function readSnapshot(key){
 try{const value=JSON.parse(fs.readFileSync(cachePath(key),"utf8"));return value&&Array.isArray(value.boxes)?value:null;}catch{return null;}
}
async function scanGame(key){
 if(gameJobs.has(key))return gameJobs.get(key);
 const job=tcgcsv.getGameBoxes(key).then(data=>{
  try{fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(cachePath(key),JSON.stringify({...data,savedAt:new Date().toISOString()}));}
  catch(err){console.warn("Snapshot save unavailable:",err.message);}
  return data;
 }).finally(()=>gameJobs.delete(key));
 gameJobs.set(key,job);return job;
}
app.get("/api/game/:key",async(req,res)=>{
 const key=req.params.key;
 if(!(Object.hasOwn(tcgcsv.GAME_NAMES,key)||Object.hasOwn(tcgcsv.SPORTS,key)))return res.status(404).json({error:"Unsupported game"});
 const snapshot=readSnapshot(key);
 if(snapshot){
  if(Date.now()-Date.parse(snapshot.savedAt||0)>24*60*60*1000)scanGame(key).catch(err=>console.warn("Background refresh:",key,err.message));
  return res.json({...snapshot,cacheStatus:"snapshot",refreshing:gameJobs.has(key)});
 }
 scanGame(key).catch(err=>console.warn("Game scan:",key,err.message));
 return res.status(202).json({status:"scanning",game:key,message:"First scan in progress. Try again shortly."});
});

require("./research/bridge").register(app);
app.get("/api/cards/sets/:game", async(req,res)=>{
 try {
  const game=req.params.game;
  if(!Object.hasOwn(tcgcsv.GAME_NAMES,game))return res.status(404).json({error:"Unsupported game"});
  const category=await tcgcsv.findCategoryByName(tcgcsv.GAME_NAMES[game]);
  const groups=await tcgcsv.listGroups(category.categoryId);
  res.json({game,sets:groups.filter(g=>g.groupId).map(g=>({id:g.groupId,name:g.name})).sort((a,b)=>a.name.localeCompare(b.name))});
 }catch(err){console.error(err);res.status(502).json({error:"Card sets unavailable"});}
});
app.get("/api/cards/:game/:groupId",async(req,res)=>{
 try{
  const game=req.params.game;
  if(!Object.hasOwn(tcgcsv.GAME_NAMES,game))return res.status(404).json({error:"Unsupported game"});
  const groupId=Number(req.params.groupId);
  if(!Number.isSafeInteger(groupId)||groupId<=0)return res.status(400).json({error:"Invalid set"});
  const category=await tcgcsv.findCategoryByName(tcgcsv.GAME_NAMES[game]);
  const groups=await tcgcsv.listGroups(category.categoryId);
  const group=groups.find(g=>g.groupId===groupId);
  if(!group)return res.status(404).json({error:"Set not found"});
  const products=await tcgcsv.getProductsWithPrices(category.categoryId,groupId);
  const excluded=/\\b(?:booster|display|box|case|carton|pack|bundle|collection|starter|deck|tin|sleeve|playmat|binder|accessor|storage|bulk|sealed|hobby|blaster|hanger|mega|etb)\\b/i;
  const cards=products.filter(p=>!excluded.test(p.name||"")&&!/sealed|accessor|box|pack|case|suppl/i.test(String(p.productType||p.type||""))).flatMap(p=>(p.prices||[]).filter(v=>Number.isFinite(v.marketPrice)&&v.marketPrice>0).map(v=>({productId:p.productId,name:p.name,variant:v.subTypeName||"Standard",marketPrice:v.marketPrice,lowPrice:Number.isFinite(v.lowPrice)?v.lowPrice:null}))).sort((a,b)=>b.marketPrice-a.marketPrice);
  res.json({game,set:group.name,currency:"USD",source:"TCGCSV daily mirror",cards});
 }catch(err){console.error(err);res.status(502).json({error:"Card prices unavailable"});}
});
app.get("/health", (req,res) => res.json({ok:true}));
app.listen(PORT, () => console.log(`Card Market Search listening on ${PORT}`));
