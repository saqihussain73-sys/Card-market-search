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
app.get("/health", (req,res) => res.json({ok:true}));
app.listen(PORT, () => console.log(`Card Market Search listening on ${PORT}`));
