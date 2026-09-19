const statusEl=document.getElementById("status");
const resultsEl=document.getElementById("results");
const loadBtn=document.getElementById("load-btn");
const countEl=document.getElementById("collection-count");
const STORAGE_KEY="card-market-search:riftbound:collected:v1";
const GAMES={riftbound:"Riftbound",pokemon:"Pokémon",onepiece:"One Piece",magic:"Magic: The Gathering",lorcana:"Disney Lorcana",gundam:"Gundam",starwars:"Star Wars Unlimited",altered:"Altered",unionarena:"Union Arena"};
let currentGame="riftbound";
let collected;
try { collected=new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")); }
catch { collected=new Set(); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return Number.isFinite(n)?"$"+n.toFixed(2):"Not available";}
const RELEASES = {
  origins:"31 October 2025",
  spiritforged:"13 February 2026",
  unleashed:"8 May 2026",
  vendetta:"31 July 2026",
  radiance:"23 October 2026 (upcoming)",
  legacy:"29 January 2027 (upcoming)"
};
function releaseDate(set) {
 const name=String(set).toLowerCase();
 const key=Object.keys(RELEASES).find(k=>name.includes(k));
 return key?RELEASES[key]:"Release date not verified";
}
function buyLinks(set,game="riftbound") {
 const query=GAMES[game]+" "+set+" sealed booster display box";
 const encoded=encodeURIComponent(query);
 return '<details class="buy"><summary>🛒 Where to buy</summary><div class="buy-links">'+
 '<a target="_blank" rel="noopener noreferrer" href="https://www.ebay.co.uk/sch/i.html?_nkw='+encoded+'">eBay UK</a>'+
 '<a target="_blank" rel="noopener noreferrer" href="https://www.tcgplayer.com/search/all/product?q='+encoded+'">TCGplayer</a>'+
 '<a target="_blank" rel="noopener noreferrer" href="https://www.cardmarket.com/en">Cardmarket</a>'+
 '</div><small>Search links only; check language, sealed condition, stock, shipping and total price before buying.</small></details>';
}
function chaseSection(chases) {
 const rows=Array.isArray(chases)?chases:[];
 return '<details class="chases"><summary>🏆 Top 3 chase cards</summary>'+
 (rows.length?'<div class="chase-list">'+rows.map((card,i)=>
 '<div class="chase-row"><span class="rank">'+(i+1)+'</span><div><div class="chase-name">'+escapeHtml(card.name)+'</div>'+
 '<div class="chase-meta">'+(card.cardNumber?'#'+escapeHtml(card.cardNumber)+' · ':'')+escapeHtml(card.variant)+'</div></div>'+
 '<div class="chase-price">'+money(card.marketPrice)+'</div></div>').join('')+'</div>':
 '<p class="chase-note">No priced individual cards available for this set yet.</p>')+
 '<small>USD market prices from TCGplayer daily mirror. Variants may represent the same card.</small></details>';
}
function updateCount(){countEl.textContent=collected.size+" collected";}
const selector=document.getElementById("game-select");
for(const [key,label] of Object.entries(GAMES)){const option=document.createElement("option");option.value=key;option.textContent=label;selector.appendChild(option);}
selector.addEventListener("change",()=>{currentGame=selector.value;loadCompareBoxes();});
async function loadCompareBoxes(){
 loadBtn.disabled=true;statusEl.className="";statusEl.textContent="Fetching "+GAMES[currentGame]+" prices…";resultsEl.replaceChildren();
 try{
  const response=await fetch("/api/game/"+encodeURIComponent(currentGame));
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"HTTP "+response.status);
  statusEl.textContent=data.boxes.length+" complete booster box listings for "+GAMES[currentGame]+". Prices are from a daily mirror.";
  for(const box of data.boxes){
   const id=currentGame+":"+String(box.productId);
   const card=document.createElement("article");card.className="box-card";
   card.innerHTML='<h2>'+escapeHtml(box.set)+'</h2><p class="product">'+escapeHtml(box.product)+'</p>'+
    '<p class="release">Release: '+escapeHtml(currentGame==='riftbound'?releaseDate(box.set):'Set catalogued '+new Date(box.releaseDate).toLocaleDateString('en-GB'))+'</p>'+buyLinks(box.set,currentGame)+chaseSection(box.chases)+
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
