// Wrapper around tcgcsv.com — a free, no-key-required daily mirror of the
// TCGplayer API. Docs: https://tcgcsv.com/docs
// Category/group/product/price structure explained there; short version:
//   category = a game (e.g. Riftbound)
//   group    = a set within that game (e.g. Origins)
//   product  = a sealed item or a card within a group

const BASE = "https://tcgcsv.com/tcgplayer";
const GAME_NAMES = {riftbound:"Riftbound",pokemon:"Pokemon",onepiece:"One Piece",magic:"Magic",lorcana:"Lorcana TCG",gundam:"Gundam Card Game",starwars:"Star Wars Unlimited",unionarena:"Union Arena",digimon:"Digimon Card Game",fusionworld:"Dragon Ball Super Fusion World",fleshandblood:"Flesh & Blood TCG",grandarchive:"Grand Archive",hololive:"hololive OFFICIAL CARD GAME",shadowverse:"Shadowverse Evolve",yugioh:"YuGiOh"};
const CACHE_MS=24*60*60*1000;
const resultCache=new Map();
let nextRequest=0;
let requestQueue=Promise.resolve();
const pendingGames=new Map();
const groupCache=new Map();

// Match individual sealed booster boxes/displays only; exclude bulk cases and packs.
const BOX_PATTERN = /\b(?:booster\s*(?:box|display)|display\s*box|booster\s*pack\s*display)\b/i;
const EXCLUDE_PATTERN = /\b(?:case|carton|bundle|collection|elite trainer|starter|deck|sleeve|mini box|gift|promo|promotional)\b/i;

let categoryCache = null;
let categoryCacheAt = 0;
const CATEGORY_CACHE_MS = 60 * 60 * 1000; // 1 hour — categories rarely change

// tcgcsv blocks requests with a generic or missing User-Agent (see
// https://tcgcsv.com/docs) — this was causing our 401s. Also self-rate-limit
// per their "be a good neighbor" guidance (~100ms between requests).
const USER_AGENT = "CardMarketScanner/1.0.0 (contact: saqihussain73@gmail.com)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  // Rate-limit request starts, not entire network round trips.
  const slot=requestQueue.then(async()=>{
    const wait=Math.max(0,nextRequest-Date.now());
    if(wait)await sleep(wait);
    nextRequest=Date.now()+200;
  });
  requestQueue=slot.catch(()=>{});
  await slot;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(url,{headers:{"User-Agent":USER_AGENT},signal:controller.signal});
    if(!res.ok)throw new Error(`tcgcsv request failed: ${res.status} ${res.statusText}`);
    return await res.json();
  }finally{clearTimeout(timeout);}
}

async function listCategories() {
  const now = Date.now();
  if (categoryCache && now - categoryCacheAt < CATEGORY_CACHE_MS) {
    return categoryCache;
  }
  const data = await getJson(`${BASE}/categories`);
  categoryCache = data.results;
  categoryCacheAt = now;
  return categoryCache;
}

async function findCategoryByName(nameFragment) {
  const categories = await listCategories();
  const match = categories.find((c) => c.name.toLowerCase()===nameFragment.toLowerCase());
  if (!match) {
    throw new Error(`Pricing category unavailable for "${nameFragment}".`);
  }
  return match;
}

async function listGroups(categoryId) {
  const data = await getJson(`${BASE}/${categoryId}/groups`);
  return data.results;
}

async function getProductsWithPrices(categoryId, groupId) {
  const [productsRes, pricesRes] = await Promise.all([
    getJson(`${BASE}/${categoryId}/${groupId}/products`),
    getJson(`${BASE}/${categoryId}/${groupId}/prices`),
  ]);
  const priceById = new Map();
  for(const price of pricesRes.results){
    if(!priceById.has(price.productId))priceById.set(price.productId,[]);
    priceById.get(price.productId).push(price);
  }
  return productsRes.results.map((p) => ({
    ...p,
    prices: priceById.get(p.productId) || [],
    price: (priceById.get(p.productId)||[]).find(p=>Number.isFinite(p.marketPrice)) || null,
  }));
}

function isCard(product) {
  const name=String(product.name||"");
  return !isSealed(name) &&
    !/\b(?:booster|display|box|case|bundle|starter|deck|pack|sleeve|playmat|promo pack|collection)\\b/i.test(name);
}
function topChases(products) {
  const candidates=[];
  for(const product of products){
    if(!isCard(product))continue;
    const variants=product.prices||[];
    for(const price of variants){
      if(!Number.isFinite(price.marketPrice)||price.marketPrice<=0)continue;
      candidates.push({
        name:product.name,productId:product.productId,
        cardNumber:product.extendedData?.find?.(d=>/number/i.test(d.name))?.value||null,
        variant:price.subTypeName||"Standard",marketPrice:price.marketPrice,
        lowPrice:price.lowPrice??null
      });
    }
  }
  candidates.sort((a,b)=>b.marketPrice-a.marketPrice);
  return candidates.slice(0,3);
}
function productType(name) {
 const n=String(name||"");
 if(/\b(?:case|carton|sleeve|playmat|single pack|loose pack)\b/i.test(n))return null;
 if(/\b(?:elite trainer box|ETB)\b/i.test(n))return "etb";
 if(/\b(?:tin|tins)\b/i.test(n))return "tin";
 if(/\b(?:starter deck|structure deck|theme deck|trial deck)\b/i.test(n))return "deck";
 if(/\b(?:bundle|collection box|premium collection|special collection)\b/i.test(n))return "bundle";
 if(BOX_PATTERN.test(n) && !EXCLUDE_PATTERN.test(n))return "booster";
 return null;
}
function isSealed(name) { return productType(name)==="booster"; }

/**
 * Walks every set in a category and returns individual booster boxes with mirrored
 * market prices, most expensive first. This is what powers "Compare Boxes".
 */
async function compareBoxes(categoryNameFragment) {
  const category = await findCategoryByName(categoryNameFragment);
  const groups = await listGroups(category.categoryId);
  const selected=groups.filter(g=>g.groupId && g.publishedOn && !Number.isNaN(Date.parse(g.publishedOn)) && Date.parse(g.publishedOn)<=Date.now()).sort((a,b)=>Date.parse(b.publishedOn)-Date.parse(a.publishedOn));

  const results = [];
  let cursor=0;
  async function worker(){
  while(cursor<selected.length){
    const group=selected[cursor++];
    const cacheKey=category.categoryId+":"+group.groupId;
    let products=groupCache.get(cacheKey);
    if(!products){
      try{products=await getProductsWithPrices(category.categoryId,group.groupId);groupCache.set(cacheKey,products);}
      catch(err){console.warn("Skipping unavailable group",group.groupId,err.message);continue;}
    }
    const chases=topChases(products);
    if(chases.length<1)continue;
    for (const p of products) {
      const type=productType(p.name);
      if (!type || !Number.isFinite(p.price?.marketPrice) || p.price.marketPrice<=0 || !Number.isFinite(p.price?.lowPrice) || p.price.lowPrice<=0) continue;
      results.push({
        type,
        set: group.name,
        groupId: group.groupId,
        releaseDate: group.publishedOn,
        product: p.name,
        productId: p.productId,
        marketPrice: p.price?.marketPrice ?? null,
        lowPrice: p.price?.lowPrice ?? null,
        fetchedAt: new Date().toISOString(),
        chases,
      });
    }
  }
  }
  await Promise.all(Array.from({length:4},()=>worker()));
  results.sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));
  return { category: category.name, categoryId: category.categoryId, boxes: results };
}

module.exports = {
  listCategories,
  findCategoryByName,
  listGroups,
  getProductsWithPrices,
  compareBoxes,
  GAME_NAMES,
  async getGameBoxes(key) {
    if(!Object.hasOwn(GAME_NAMES,key))throw new Error("Unsupported game");
    const cached=resultCache.get(key);
    if(cached && Date.now()-cached.at<CACHE_MS)return cached.value;
    if(pendingGames.has(key))return pendingGames.get(key);
    const job=compareBoxes(GAME_NAMES[key]).then(value=>{resultCache.set(key,{at:Date.now(),value});return value;}).finally(()=>pendingGames.delete(key));
    pendingGames.set(key,job);
    return job;
  },
};
