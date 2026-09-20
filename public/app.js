const statusEl=document.getElementById("status");
const resultsEl=document.getElementById("results");
const loadBtn=document.getElementById("load-btn");
const countEl=document.getElementById("collection-count");
const STORAGE_KEY="card-market-search:riftbound:collected:v1";
const GAMES={riftbound:"Riftbound",pokemon:"Pokémon",onepiece:"One Piece",magic:"Magic: The Gathering",lorcana:"Disney Lorcana",gundam:"Gundam",starwars:"Star Wars Unlimited",unionarena:"Union Arena",digimon:"Digimon Card Game",fusionworld:"Dragon Ball Super: Fusion World",fleshandblood:"Flesh and Blood",grandarchive:"Grand Archive",hololive:"hololive OFFICIAL CARD GAME",shadowverse:"Shadowverse: Evolve",yugioh:"Yu-Gi-Oh!"};
const LIMITED_GAMES=new Set(["pokemon","yugioh"]);
const PRICE_FILTERS={250:"Up to $250",all:"All prices"};
const SORT_FILTERS={cheapest:"Cheapest first",newest:"Newest sets first",expensive:"Most expensive first"};
const filterBar=document.getElementById("limited-filters");
const priceFilter=document.getElementById("price-filter");
const sortFilter=document.getElementById("sort-filter");
function syncLimitedFilters(){
 const limited=LIMITED_GAMES.has(currentGame);
 filterBar.hidden=!limited;
 if(limited){priceFilter.value="250";sortFilter.value="cheapest";}
}
priceFilter.addEventListener("change",()=>loadCompareBoxes(false));
sortFilter.addEventListener("change",()=>loadCompareBoxes(false));
const SPORTS={soccer:"Football / Soccer",basketball:"Basketball",football:"American football",baseball:"Baseball",f1:"Formula 1",ufc:"UFC",cricket:"Cricket",hockey:"Ice hockey"};
Object.assign(GAMES,SPORTS);
let currentGame="riftbound";
let loadSequence=0;
const viewCache=new Map();
const SNAPSHOT_PREFIX="card-market-search:game-snapshot:v2:";
function savedGame(game){
 try{const data=JSON.parse(localStorage.getItem(SNAPSHOT_PREFIX+game)||"null");return data&&Array.isArray(data.boxes)?data:null;}catch{return null;}
}
function rememberGame(game,data){
 viewCache.set(game,data);
 try{localStorage.setItem(SNAPSHOT_PREFIX+game,JSON.stringify(data));}catch{}
}
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
function buyLinks(box,game="riftbound") {
 const query=GAMES[game]+" "+box.product+(box.product.toLowerCase().includes(box.set.toLowerCase())?"":" "+box.set);
 const encoded=encodeURIComponent(query);
 return '<details class="buy"><summary>🛒 Where to buy this product</summary>'+
  '<div class="buy-links">'+
  '<a target="_blank" rel="noopener noreferrer" href="https://www.amazon.co.uk/s?k='+encoded+'">Amazon UK · search</a>'+
  '<a target="_blank" rel="noopener noreferrer" href="https://www.ebay.co.uk/sch/i.html?_nkw='+encoded+'">eBay UK · search</a>'+
  '</div><small>These are product searches, not verified listings or prices. Check the game, set, language, edition and sealed condition before buying.</small></details>';
}

function gradedSection(card) {
 const grades=card.gradedPrices;
 if(!grades || typeof grades!=="object")return "";
 const entries=[["PSA 9",grades.psa9],["PSA 10",grades.psa10]].filter(([,v])=>v && Number.isFinite(v.price) && v.price>0 && v.currency==="USD" && v.source && v.updatedAt && !Number.isNaN(Date.parse(v.updatedAt)));
 if(!entries.length)return "";
 return '<div class="chase-meta">'+entries.map(([label,v])=>escapeHtml(label)+': <strong>'+money(v.price)+'</strong> · '+escapeHtml(v.source)+' · '+escapeHtml(new Date(v.updatedAt).toLocaleDateString("en-GB"))).join('<br>')+'</div>';
}
function chaseSection(chases) {
 const rows=Array.isArray(chases)?chases:[];
 return '<details class="chases"><summary>🏆 Chase cards (up to 3)</summary>'+
 (rows.length?'<div class="chase-list">'+rows.map((card,i)=>
 '<div class="chase-row"><span class="rank">'+(i+1)+'</span><div><div class="chase-name">'+escapeHtml(card.name)+'</div>'+
 '<div class="chase-meta">'+(card.cardNumber?'#'+escapeHtml(card.cardNumber)+' · ':'')+escapeHtml(card.variant)+'</div></div>'+
 '<div class="chase-price">Raw '+money(card.marketPrice)+gradedSection(card)+'</div></div>').join('')+'</div>':
 '<p class="chase-note">No priced individual cards available for this set yet.</p>')+
 '<small>USD market prices from TCGplayer daily mirror. Variants may represent the same card.</small></details>';
}
function updateCount(){countEl.textContent=collected.size+" collected";}
const typeSelector=document.getElementById("type-select");
const SPORTS_TYPES={hobby:"Hobby boxes",retail:"Retail boxes",pack:"Individual packs",all:"All sports products"};
const TYPES={booster:"Booster boxes",etb:"Elite Trainer Boxes",tin:"Tins",bundle:"Bundles & collections",deck:"Starter decks",all:"All sealed products"};
function updateTypes(boxes){
 const sports=Object.hasOwn(SPORTS,currentGame);
 const labels=sports?SPORTS_TYPES:TYPES;
 const available=new Set(boxes.map(box=>box.type||"booster"));
 const previous=typeSelector.value;
 typeSelector.replaceChildren();
 for(const [value,label] of Object.entries(labels)){
  if(value!=="all" && !available.has(value))continue;
  if(value==="all" && available.size<2)continue;
  const option=document.createElement("option");option.value=value;option.textContent=label;typeSelector.appendChild(option);
 }
 typeSelector.value=[...typeSelector.options].some(option=>option.value===previous)?previous:(sports?"hobby":"booster");
}
typeSelector.addEventListener("change",()=>loadCompareBoxes(false));
const selector=document.getElementById("game-select");
for(const [key,label] of Object.entries(GAMES)){const option=document.createElement("option");option.value=key;option.textContent=label;selector.appendChild(option);}
selector.addEventListener("change",()=>{currentGame=selector.value;typeSelector.value=Object.hasOwn(SPORTS,currentGame)?"hobby":"booster";syncLimitedFilters();loadCompareBoxes(false);});
async function loadCompareBoxes(force=false){
 const game=currentGame;
 const sequence=++loadSequence;
 resultsEl.replaceChildren();
 loadBtn.disabled=true;statusEl.className="";
 statusEl.textContent="Loading "+GAMES[game]+"… You can browse other games while this loads.";
 try{
  let data=viewCache.get(game)||savedGame(game);
  if(data&&!force){renderGame(game,data);loadBtn.disabled=false;return;}
  const response=await fetch("/api/game/"+encodeURIComponent(game),{cache:"no-store"});
  const incoming=await response.json();
  if(response.status===202){
   if(sequence!==loadSequence)return;
   resultsEl.replaceChildren();
   statusEl.textContent=GAMES[game]+" scan pending. Checking again in 5 seconds…";
   setTimeout(()=>{if(sequence===loadSequence)loadCompareBoxes(true);},5000);
   return;
  }
  if(!response.ok)throw new Error(incoming.error||"HTTP "+response.status);
  data=incoming;
  rememberGame(game,data);
  if(sequence!==loadSequence)return;
  renderGame(game,data);
 }catch(error){if(sequence!==loadSequence)return;resultsEl.replaceChildren();statusEl.className="error";statusEl.textContent="Could not load prices: "+error.message;}
 finally{if(sequence===loadSequence)loadBtn.disabled=false;updateCount();}
}
function renderGame(game,data){
 if(game!==currentGame)return;
  updateTypes(data.boxes);
  const limited=LIMITED_GAMES.has(game);
  const boxes=data.boxes.filter(box=>(typeSelector.value==="all" || (box.type||"booster")===typeSelector.value) && (!limited || priceFilter.value==="all" || (Number.isFinite(box.marketPrice)&&box.marketPrice<=250)));
  if(limited){
   if(sortFilter.value==="cheapest")boxes.sort((a,b)=>a.marketPrice-b.marketPrice);
   else if(sortFilter.value==="expensive")boxes.sort((a,b)=>b.marketPrice-a.marketPrice);
   else boxes.sort((a,b)=>Date.parse(b.releaseDate||0)-Date.parse(a.releaseDate||0));
  }
  resultsEl.replaceChildren();
  statusEl.textContent=boxes.length+" priced "+(Object.hasOwn(SPORTS,game)?SPORTS_TYPES:TYPES)[typeSelector.value].toLowerCase()+" for "+GAMES[game]+". Prices are from a daily mirror.";
  for(const box of boxes){
   const id=game+":"+String(box.productId);
   const card=document.createElement("article");card.className="box-card";
   card.innerHTML='<h2>'+escapeHtml(box.set)+'</h2><p class="product">'+escapeHtml(box.product)+'</p>'+
    '<p class="release">'+(Object.hasOwn(SPORTS,game)?'Set catalogued: ':'Release: ')+escapeHtml(game==='riftbound'?releaseDate(box.set):'Set catalogued '+new Date(box.releaseDate).toLocaleDateString('en-GB'))+'</p>'+buyLinks(box,game)+chaseSection(box.chases)+
    '<div class="prices"><div><small>US market reference (USD)</small><strong>'+money(box.marketPrice)+'</strong></div>'+
    '<div><small>Lowest listing (USD)</small><strong>'+money(box.lowPrice)+'</strong></div></div>'+
    '<label class="collect"><input type="checkbox" '+(collected.has(id)?"checked":"")+'> In my sealed collection</label>';
   card.querySelector("input").addEventListener("change",event=>{
    if(event.target.checked)collected.add(id);else collected.delete(id);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...collected]));}catch{}
    updateCount();
   });
   resultsEl.appendChild(card);
  }

}
loadBtn.addEventListener("click",()=>loadCompareBoxes(true));
syncLimitedFilters();updateCount();loadCompareBoxes();
