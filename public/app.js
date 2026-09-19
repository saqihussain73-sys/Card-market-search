const statusEl=document.getElementById("status"),resultsEl=document.getElementById("results"),gameInput=document.getElementById("game-input"),loadBtn=document.getElementById("load-btn");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadCompareBoxes(){
 const game=gameInput.value.trim()||"riftbound";loadBtn.disabled=true;resultsEl.replaceChildren();statusEl.textContent=`Fetching prices for ${game}…`;
 try{
  const res=await fetch(`/api/compare-boxes?game=${encodeURIComponent(game)}`),data=await res.json();
  if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
  statusEl.textContent=`${data.boxes.length} sealed products found for ${data.category}. Prices are from a daily mirror, not live transactions.`;
  const money=n=>Number.isFinite(n)?`$${n.toFixed(2)}`:"n/a";
  resultsEl.innerHTML=`<table><thead><tr><th>Set</th><th>Product</th><th>Market price</th><th>Low price</th></tr></thead><tbody>${data.boxes.map(b=>`<tr><td>${escapeHtml(b.set)}</td><td>${escapeHtml(b.product)}</td><td class="price">${money(b.marketPrice)}</td><td class="price">${money(b.lowPrice)}</td></tr>`).join("")}</tbody></table>`;
 }catch(err){statusEl.textContent=`Error: ${err.message}`;statusEl.className="error";}finally{loadBtn.disabled=false;}
}
loadBtn.addEventListener("click",loadCompareBoxes);gameInput.addEventListener("keydown",e=>{if(e.key==="Enter")loadCompareBoxes()});loadCompareBoxes();
