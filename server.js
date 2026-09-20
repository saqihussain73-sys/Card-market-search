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

app.get("/health", (req,res) => res.json({ok:true}));
app.listen(PORT, () => console.log(`Card Market Search listening on ${PORT}`));
