const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
const db = process.env.TCG_RESEARCH_DB || path.join(__dirname, "tcg.db");
const script = path.join(__dirname, "tcg_research.py");
function register(app) {
 app.get("/api/research/status", (req,res) => {
  let available = false;
  try { available = fs.statSync(db).size > 0; } catch {}
  res.json({available, configured:!!process.env.TCG_RESEARCH_DB,
    message:available?"Historical database present":"Historical database not populated; no research candidates available"});
 });
 app.get("/api/research/candidates", (req,res) => {
  if(!fs.existsSync(db)) return res.status(503).json({error:"Historical data not yet populated"});
  const python=process.env.PYTHON_BIN || "python3";
  const child=spawn(python,[script,"--db",db,"scan"],{stdio:["ignore","pipe","pipe"]});
  let out="",err="";
  const limit=1024*1024;
  child.stdout.on("data",b=>{out+=b;if(out.length>limit)child.kill();});
  child.stderr.on("data",b=>{err+=b;if(err.length>limit)child.kill();});
  child.on("error",e=>res.headersSent?null:res.status(503).json({error:e.message}));
  child.on("close",code=>{if(res.headersSent)return;
    if(code!==0)return res.status(503).json({error:"Research scanner unavailable",detail:err.slice(0,500)});
    try {res.json({currency:"USD",confidence:"low",candidates:JSON.parse(out)});}
    catch {res.status(502).json({error:"Invalid research output"});}
  });
 });
}
module.exports={register};
