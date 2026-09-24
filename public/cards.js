const sealedTab=document.getElementById("sealed-tab");
const cardsTab=document.getElementById("cards-tab");
const sealedView=document.getElementById("sealed-view");
const cardsView=document.getElementById("cards-view");
const cardGame=document.getElementById("card-game");
const cardSet=document.getElementById("card-set");
const cardSearch=document.getElementById("card-search");
const cardSort=document.getElementById("card-sort");
const cardStatus=document.getElementById("card-status");
const cardResults=document.getElementById("card-results");
let cards=[],sequence=0;
function showCards(active){
 sealedView.hidden=active;cardsView.hidden=!active;
 sealedTab.setAttribute("aria-pressed",String(!active));cardsTab.setAttribute("aria-pressed",String(active));
 if(active&&!cardSet.options.length)loadSets();
}
sealedTab.addEventListener("click",()=>showCards(false));
cardsTab.addEventListener("click",()=>showCards(true));
function escapeCard(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderCards(){
 const q=cardSearch.value.trim().toLowerCase();
 const filtered=cards.filter(c=>c.name.toLowerCase().includes(q)||c.variant.toLowerCase().includes(q));
 if(cardSort.value==="highest")filtered.sort((a,b)=>b.marketPrice-a.marketPrice);
 else if(cardSort.value==="lowest")filtered.sort((a,b)=>a.marketPrice-b.marketPrice);
 else filtered.sort((a,b)=>a.name.localeCompare(b.name));
 cardStatus.textContent=filtered.length+" individual card variants · USD market reference";
 cardResults.replaceChildren();
 for(const c of filtered.slice(0,500)){
  const node=document.createElement("article");node.className="box-card";
  node.innerHTML="<h2>"+escapeCard(c.name)+"</h2><p class='product'>"+escapeCard(c.variant)+"</p><div class='prices'><div><small>Market price (USD)</small><strong>$"+c.marketPrice.toFixed(2)+"</strong></div><div><small>Low listing (USD)</small><strong>"+(c.lowPrice===null?"Unavailable":"$"+c.lowPrice.toFixed(2))+"</strong></div></div>";
  cardResults.appendChild(node);
 }
 if(filtered.length>500){const p=document.createElement("p");p.textContent="Showing first 500 results. Refine the card name to narrow the list.";cardResults.appendChild(p);}
}
async function loadSets(){
 const n=++sequence;cardSet.replaceChildren();cards=[];cardResults.replaceChildren();
 cardStatus.textContent="Loading sets…";
 try{
  const r=await fetch("/api/cards/sets/"+encodeURIComponent(cardGame.value));
  const data=await r.json();if(!r.ok)throw Error(data.error||"Sets unavailable");
  if(n!==sequence)return;
  for(const set of data.sets){const o=document.createElement("option");o.value=set.id;o.textContent=set.name;cardSet.appendChild(o);}
  if(cardSet.options.length)await loadCards();
  else cardStatus.textContent="No sets available for this game.";
 }catch(e){if(n===sequence)cardStatus.textContent="Could not load sets: "+e.message;}
}
async function loadCards(){
 const n=++sequence;cards=[];cardResults.replaceChildren();cardStatus.textContent="Loading individual cards…";
 try{
  const r=await fetch("/api/cards/"+encodeURIComponent(cardGame.value)+"/"+encodeURIComponent(cardSet.value));
  const data=await r.json();if(!r.ok)throw Error(data.error||"Card prices unavailable");
  if(n!==sequence)return;cards=data.cards;renderCards();
 }catch(e){if(n===sequence)cardStatus.textContent="Could not load cards: "+e.message;}
}
cardGame.addEventListener("change",loadSets);
cardSet.addEventListener("change",loadCards);
cardSearch.addEventListener("input",renderCards);
cardSort.addEventListener("change",renderCards);
