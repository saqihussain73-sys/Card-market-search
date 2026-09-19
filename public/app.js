const statusEl=document.getElementById("status");
const resultsEl=document.getElementById("results");
const loadBtn=document.getElementById("load-btn");
const countEl=document.getElementById("collection-count");
const STORAGE_KEY="card-market-search:riftbound:collected:v1";
const GAMES={riftbound:"Riftbound",pokemon:"Pokémon",onepiece:"One Piece",magic:"Magic: The Gathering",lorcana:"Disney Lorcana",gundam:"Gundam",starwars:"Star Wars Unlimited",unionarena:"Union Arena",digimon:"Digimon Card Game",fusionworld:"Dragon Ball Super: Fusion World",fleshandblood:"Flesh and Blood",grandarchive:"Grand Archive",hololive:"hololive OFFICIAL CARD GAME",shadowverse:"Shadowverse: Evolve",yugioh:"Yu-Gi-Oh!"};
let currentGame="riftbound";
let loadSequence=0;
const viewCache=new Map();
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
 const google=encodeURIComponent(query+" UK buy sealed");
 const id=Number(box.productId);
 const direct=Number.isSafeInteger(id)&&id>0
  ?'<a target="_blank" rel="noopener noreferrer" href="https://www.tcgplayer.com/product/'+id+'">TCGplayer · exact product</a>':'';
 const link=(label,url)=>'<a target="_blank" rel="noopener noreferrer" href="'+url+'">'+label+'</a>';
 const marketplaces=link("Amazon UK · search","https://www.amazon.co.uk/s?k="+encoded)+
  link("eBay UK · search","https://www.ebay.co.uk/sch/i.html?_nkw="+encoded)+
  link("Google Shopping UK · search","https://www.google.com/search?tbm=shop&gl=uk&q="+google);
 const specialist=link("Magic Madhouse · search","https://www.google.com/search?q="+encodeURIComponent("site:magicmadhouse.co.uk "+query))+
  link("Total Cards · search","https://www.google.com/search?q="+encodeURIComponent("site:totalcards.net "+query));
 const local=link("CardboardCrack · Stretford","https://www.google.com/search?q="+encodeURIComponent("site:cardboardcrack.co.uk "+query))+
  link("Pulse Collective · Middleton","https://www.google.com/search?q="+encodeURIComponent("site:pulsecollective.co.uk "+query))+
  link("Fan Boy Three · Manchester","https://www.google.com/search?q="+encodeURIComponent("Fan Boy Three Manchester "+query))+
  "";
 const highStreet=game==="pokemon"?'<div class="chase-meta">High-street shops · check local availability</div><div class="buy-links">'+
  link("Argos · search","https://www.argos.co.uk/search/"+encoded+"/")+
  link("Smyths Toys · search","https://www.google.com/search?q="+encodeURIComponent("site:smythstoys.com/uk/en-gb "+query))+'</div>':"";
 return '<details class="buy"><summary>🛒 Where to buy this product</summary>'+
  '<div class="chase-meta">Exact product reference</div><div class="buy-links">'+direct+'</div>'+
  '<div class="chase-meta">UK marketplaces</div><div class="buy-links">'+marketplaces+'</div>'+
  '<div class="chase-meta">UK card retailers</div><div class="buy-links">'+specialist+'</div>'+
  '<div class="chase-meta">Manchester & nearby · search or contact shop</div><div class="buy-links">'+local+'</div>'+highStreet+
  '<small>Links are searches unless marked exact product. No UK stock or checkout price is verified. Match game, set, language, edition and sealed condition; compare delivery and import costs. USD scanner prices are US market references, not UK offers.</small></details>';
}

async function showCardEmpire(card,box,game){
 if(!["pokemon","yugioh"].includes(game))return;
 try{
  const params=new URLSearchParams({game,product:box.product,set:box.set,type:box.type||"booster"});
  const response=await fetch("/api/retail/card-empire?"+params);
  if(!response.ok)return;
  const data=await response.json(),offer=data.offer;
  if(!offer||!Number.isFinite(offer.priceGBP)||offer.priceGBP<=0||!/^https:\/\/www\.cardempire\.com\/products\//.test(offer.url))return;
  if(!card.isConnected)return;
  const links=card.querySelector(".buy .buy-links:last-of-type");
  const section=document.createElement("div");
  section.className="card-empire-offer";
  const label=document.createElement("div");label.className="chase-meta";label.textContent="Card Empire · online listed price";
  const row=document.createElement("div");row.className="buy-links";
  const link=document.createElement("a");link.href=offer.url;link.target="_blank";link.rel="noopener noreferrer";
  link.textContent="Card Empire · £"+offer.priceGBP.toFixed(2)+" · exact product page";
  row.appendChild(link);section.append(label,row);
  const note=card.querySelector(".buy small");note.before(section);
 }catch{}
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
const TYPES={booster:"Booster boxes",etb:"Elite Trainer Boxes",tin:"Tins",bundle:"Bundles & collections",deck:"Starter decks",all:"All sealed products"};
function updateTypes(boxes){
 const available=new Set(boxes.map(box=>box.type||"booster"));
 const previous=typeSelector.value;
 typeSelector.replaceChildren();
 for(const [value,label] of Object.entries(TYPES)){
  if(value!=="all" && value!=="booster" && !available.has(value))continue;
  if(value==="all" && available.size<2)continue;
  const option=document.createElement("option");option.value=value;option.textContent=label;typeSelector.appendChild(option);
 }
 typeSelector.value=[...typeSelector.options].some(option=>option.value===previous)?previous:"booster";
}
typeSelector.addEventListener("change",()=>loadCompareBoxes());
const selector=document.getElementById("game-select");
for(const [key,label] of Object.entries(GAMES)){const option=document.createElement("option");option.value=key;option.textContent=label;selector.appendChild(option);}
selector.addEventListener("change",()=>{currentGame=selector.value;typeSelector.value="booster";loadCompareBoxes();});
async function loadCompareBoxes(){
 const game=currentGame;
 const sequence=++loadSequence;
 loadBtn.disabled=true;statusEl.className="";
 statusEl.textContent="Loading "+GAMES[game]+"… You can browse other games while this loads.";
 resultsEl.replaceChildren();
 try{
  let data=viewCache.get(game);
  if(!data){
   const response=await fetch("/api/game/"+encodeURIComponent(game));
   data=await response.json();
   if(!response.ok)throw new Error(data.error||"HTTP "+response.status);
   viewCache.set(game,data);
  }
  if(sequence!==loadSequence)return;
  updateTypes(data.boxes);
  const boxes=data.boxes.filter(box=>typeSelector.value==="all" || (box.type||"booster")===typeSelector.value);
  statusEl.textContent=boxes.length+" priced "+TYPES[typeSelector.value].toLowerCase()+" for "+GAMES[game]+". Prices are from a daily mirror.";
  for(const box of boxes){
   const id=game+":"+String(box.productId);
   const card=document.createElement("article");card.className="box-card";
   card.innerHTML='<h2>'+escapeHtml(box.set)+'</h2><p class="product">'+escapeHtml(box.product)+'</p>'+
    '<p class="release">Release: '+escapeHtml(game==='riftbound'?releaseDate(box.set):'Set catalogued '+new Date(box.releaseDate).toLocaleDateString('en-GB'))+'</p>'+buyLinks(box,game)+chaseSection(box.chases)+
    '<div class="prices"><div><small>US market reference (USD)</small><strong>'+money(box.marketPrice)+'</strong></div>'+
    '<div><small>Lowest listing (USD)</small><strong>'+money(box.lowPrice)+'</strong></div></div>'+
    '<label class="collect"><input type="checkbox" '+(collected.has(id)?"checked":"")+'> In my sealed collection</label>';
   card.querySelector("input").addEventListener("change",event=>{
    if(event.target.checked)collected.add(id);else collected.delete(id);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...collected]));}catch{}
    updateCount();
   });
   resultsEl.appendChild(card);
   showCardEmpire(card,box,game);
  }
 }catch(error){if(sequence!==loadSequence)return;statusEl.className="error";statusEl.textContent="Could not load prices: "+error.message;}
 finally{if(sequence===loadSequence)loadBtn.disabled=false;updateCount();}
}
loadBtn.addEventListener("click",loadCompareBoxes);
updateCount();loadCompareBoxes();
