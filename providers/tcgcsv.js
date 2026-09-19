// Wrapper around tcgcsv.com — a free, no-key-required daily mirror of the
// TCGplayer API. Docs: https://tcgcsv.com/docs
// Category/group/product/price structure explained there; short version:
//   category = a game (e.g. Riftbound)
//   group    = a set within that game (e.g. Origins)
//   product  = a sealed item or a card within a group

const BASE = "https://tcgcsv.com/tcgplayer";

// Match individual sealed booster boxes/displays only; exclude bulk cases and packs.
const BOX_PATTERN = /\b(?:booster box|booster display|display box)\b/i;
const EXCLUDE_PATTERN = /\b(?:case|carton|pack|bundle|collection|elite trainer|starter|deck|sleeve|mini box|gift|promo|promotional)\b/i;

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
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  await sleep(100);
  if (!res.ok) {
    throw new Error(`tcgcsv request failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
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
  const match = categories.find((c) =>
    c.name.toLowerCase().includes(nameFragment.toLowerCase())
  );
  if (!match) {
    const names = categories.map((c) => c.name).sort().join(", ");
    throw new Error(`No tcgcsv category matching "${nameFragment}". Available: ${names}`);
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
  const priceById = new Map(pricesRes.results.map((p) => [p.productId, p]));
  return productsRes.results.map((p) => ({
    ...p,
    price: priceById.get(p.productId) || null,
  }));
}

function isSealed(name) {
  return BOX_PATTERN.test(name) && !EXCLUDE_PATTERN.test(name);
}

/**
 * Walks every set in a category and returns individual booster boxes with mirrored
 * market prices, most expensive first. This is what powers "Compare Boxes".
 */
async function compareBoxes(categoryNameFragment) {
  const category = await findCategoryByName(categoryNameFragment);
  const groups = await listGroups(category.categoryId);

  const results = [];
  for (const group of groups) {
    const products = await getProductsWithPrices(category.categoryId, group.groupId);
    for (const p of products) {
      if (!isSealed(p.name)) continue;
      results.push({
        set: group.name,
        groupId: group.groupId,
        product: p.name,
        productId: p.productId,
        marketPrice: p.price?.marketPrice ?? null,
        lowPrice: p.price?.lowPrice ?? null,
        fetchedAt: new Date().toISOString(),
      });
    }
  }
  results.sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0));
  return { category: category.name, categoryId: category.categoryId, boxes: results };
}

module.exports = {
  listCategories,
  findCategoryByName,
  listGroups,
  getProductsWithPrices,
  compareBoxes,
};
