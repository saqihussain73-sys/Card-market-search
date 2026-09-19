const BASE = "https://tcgcsv.com/tcgplayer";
const SEALED_KEYWORDS = ["booster box","booster display","booster pack","bundle","elite trainer"];
let categoryCache = null, categoryCacheAt = 0;
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tcgcsv request failed: ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}
async function listCategories() {
  if (categoryCache && Date.now() - categoryCacheAt < 3600000) return categoryCache;
  const data = await getJson(`${BASE}/categories`);
  categoryCache = data.results; categoryCacheAt = Date.now(); return categoryCache;
}
async function findCategoryByName(fragment) {
  const match = (await listCategories()).find(c => c.name.toLowerCase().includes(fragment.toLowerCase()));
  if (!match) throw new Error(`No tcgcsv category matching "${fragment}"`);
  return match;
}
async function listGroups(categoryId) {
  return (await getJson(`${BASE}/${categoryId}/groups`)).results;
}
async function getProductsWithPrices(categoryId,groupId) {
  const [products,prices] = await Promise.all([
    getJson(`${BASE}/${categoryId}/${groupId}/products`),
    getJson(`${BASE}/${categoryId}/${groupId}/prices`)
  ]);
  const byId = new Map(prices.results.map(p => [p.productId,p]));
  return products.results.map(p => ({...p,price:byId.get(p.productId)||null}));
}
async function compareBoxes(fragment) {
  const category = await findCategoryByName(fragment);
  const groups = await listGroups(category.categoryId);
  const boxes = [];
  for (const group of groups) {
    const products = await getProductsWithPrices(category.categoryId,group.groupId);
    for (const p of products) {
      if (!SEALED_KEYWORDS.some(k => p.name.toLowerCase().includes(k))) continue;
      boxes.push({set:group.name,groupId:group.groupId,product:p.name,productId:p.productId,
        marketPrice:p.price?.marketPrice??null,lowPrice:p.price?.lowPrice??null,fetchedAt:new Date().toISOString()});
    }
  }
  boxes.sort((a,b)=>(b.marketPrice??0)-(a.marketPrice??0));
  return {category:category.name,categoryId:category.categoryId,boxes};
}
module.exports={listCategories,findCategoryByName,listGroups,getProductsWithPrices,compareBoxes};
