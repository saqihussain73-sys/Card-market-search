const statusEl=document.getElementById("status");
const resultsEl=document.getElementById("results");
const loadBtn=document.getElementById("load-btn");
const countEl=document.getElementById("collection-count");
const STORAGE_KEY="card-market-search:riftbound:collected:v1";
let collected;
try { collected=new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")); }
catch { collected=new Set(); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return Number.isFinite(n)?"$"+n.toFixed(2):"Not available";}
function updateCount(){countEl.textContent=collected.size+" collected";}
async function loadCompareBoxes(){
 loadBtn.disabled=true;statusEl.className="";statusEl.textContent="Fetching Riftbound prices…";resultsEl.replaceChildren();
 try{
  const response=await fetch("/api/compare-boxes?game=riftbound");
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"HTTP "+response.status);
  statusEl.textContent=data.boxes.length+" individual booster boxes found. Prices are from a daily mirror.";
  for(const box of data.boxes){
   const id=String(box.productId);
   const card=document.createElement("article");card.className="box-card";
   card.innerHTML='<h2>'+escapeHtml(box.set)+'</h2><p class="product">'+escapeHtml(box.product)+'</p>'+
    '<div class="prices"><div><small>Market price (USD)</small><strong>'+money(box.marketPrice)+'</strong></div>'+
    '<div><small>Lowest listing (USD)</small><strong>'+money(box.lowPrice)+'</strong></div></div>'+
    '<label class="collect"><input type="checkbox" '+(collected.has(id)?"checked":"")+'> In my sealed collection</label>';
   card.querySelector("input").addEventListener("change",event=>{
    if(event.target.checked)collected.add(id);else collected.delete(id);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...collected]));}catch{}
    updateCount();
   });
   resultsEl.appendChild(card);
  }
 }catch(error){statusEl.className="error";statusEl.textContent="Could not load prices: "+error.message;}
 finally{loadBtn.disabled=false;updateCount();}
}
loadBtn.addEventListener("click",loadCompareBoxes);
updateCount();loadCompareBoxes();
