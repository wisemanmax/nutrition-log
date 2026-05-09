import { openDB, IDBPDatabase } from 'idb';
import type { FoodItem } from '../types';

const DB_NAME = 'nutrition-log-foods';
const DB_VERSION = 2;
const STORE = 'foods';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ENTRIES = 2000;

const USDA_API_KEY = 'DEMO_KEY'; // Replace with real key; DEMO_KEY: 30 req/hr
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';

interface CachedFood extends FoodItem {
  cachedAt: number;
  lastUsed: number;
  query?: string;
  results?: FoodItem[];
}

// ─── IndexedDB setup ─────────────────────────────────────────────────────────

let _dbPromise: Promise<IDBPDatabase> | null = null;
function getDb(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('query', 'query');
          store.createIndex('barcode', 'barcode');
          store.createIndex('cachedAt', 'cachedAt');
        }
        if (oldVersion < 2) {
          const store = (db as any).transaction?.objectStore?.(STORE);
          if (store && !store.indexNames.contains('lastUsed')) {
            store.createIndex('lastUsed', 'lastUsed');
          }
        }
      },
    });
  }
  return _dbPromise!;
}

async function cacheGet(id: string): Promise<CachedFood | null> {
  try {
    const db = await getDb();
    const item = await db.get(STORE, id) as CachedFood | undefined;
    if (!item) return null;
    if (Date.now() - item.cachedAt > CACHE_TTL_MS) return null;
    await db.put(STORE, { ...item, lastUsed: Date.now() }).catch(() => {});
    return item;
  } catch { return null; }
}

async function cacheSet(item: Partial<CachedFood>): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, { ...item, cachedAt: Date.now(), lastUsed: Date.now() });
    cacheEvictLRU(db).catch(() => {});
  } catch {}
}

async function cacheEvictLRU(db: IDBPDatabase): Promise<void> {
  try {
    const count = await db.count(STORE);
    if (count <= MAX_CACHE_ENTRIES) return;
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.store.index('lastUsed');
    let toDelete = count - MAX_CACHE_ENTRIES;
    let cursor = await index.openCursor();
    while (cursor && toDelete > 0) {
      await cursor.delete();
      toDelete--;
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {}
}

async function cacheEvict(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.store.index('cachedAt');
    const cutoff = Date.now() - CACHE_TTL_MS;
    let cursor = await index.openCursor();
    while (cursor) {
      if ((cursor.value as CachedFood).cachedAt < cutoff) await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {}
}

// ─── USDA FoodData Central ────────────────────────────────────────────────────

function normalizeUsda(food: Record<string, any>): FoodItem {
  const nutrients: Record<string, number> = {};
  ((food.foodNutrients || []) as Array<Record<string, any>>).forEach(n => {
    const name = ((n.nutrientName || n.name || '') as string).toLowerCase();
    const val = (n.value || n.amount || 0) as number;
    if (name.includes('energy') && (name.includes('kcal') || n.unitName === 'kcal')) nutrients.cal = Math.round(val);
    else if (name === 'protein') nutrients.protein = Math.round(val * 10) / 10;
    else if (name.includes('carbohydrate') && !name.includes('sugar')) nutrients.carbs = Math.round(val * 10) / 10;
    else if (name.includes('total lipid') || name === 'total fat' || name.includes('total fat')) nutrients.fat = Math.round(val * 10) / 10;
    else if (name.includes('fiber') && name.includes('dietary')) nutrients.fiber = Math.round(val * 10) / 10;
    else if (name.includes('sodium')) nutrients.sodium = Math.round(val);
    else if (name.includes('sugars, total')) nutrients.sugar = Math.round(val * 10) / 10;
    else if (name.includes('saturated')) nutrients.satFat = Math.round(val * 10) / 10;
    else if (name.includes('cholesterol')) nutrients.cholesterol = Math.round(val);
    else if (name.includes('calcium')) nutrients.calcium = Math.round(val);
    else if (name === 'iron, fe' || name.includes('iron,')) nutrients.iron = Math.round(val * 100) / 100;
    else if (name.includes('potassium')) nutrients.potassium = Math.round(val);
    else if (name.includes('magnesium')) nutrients.magnesium = Math.round(val);
    else if (name.includes('zinc')) nutrients.zinc = Math.round(val * 10) / 10;
    else if (name.includes('phosphorus')) nutrients.phosphorus = Math.round(val);
    else if (name.includes('selenium')) nutrients.selenium = Math.round(val * 10) / 10;
    else if (name.includes('vitamin c')) nutrients.vitaminC = Math.round(val);
    else if (name.includes('vitamin d')) nutrients.vitaminD = Math.round(val * 10) / 10;
    else if (name.includes('vitamin a,')) nutrients.vitaminA = Math.round(val);
    else if (name.includes('vitamin e')) nutrients.vitaminE = Math.round(val * 10) / 10;
    else if (name.includes('vitamin k')) nutrients.vitaminK = Math.round(val * 10) / 10;
    else if (name.includes('vitamin b-12') || name.includes('vitamin b12')) nutrients.vitaminB12 = Math.round(val * 100) / 100;
    else if (name.includes('vitamin b-6') || name.includes('pyridoxine')) nutrients.vitaminB6 = Math.round(val * 10) / 10;
    else if (name.includes('thiamin')) nutrients.thiamin = Math.round(val * 10) / 10;
    else if (name.includes('riboflavin')) nutrients.riboflavin = Math.round(val * 10) / 10;
    else if (name.includes('niacin')) nutrients.niacin = Math.round(val * 10) / 10;
    else if (name.includes('folate, dfe') || name.includes('folic acid')) nutrients.folate = Math.round(val);
    else if (name.includes('choline')) nutrients.choline = Math.round(val);
    else if (name.includes('omega-3') || name.includes('epa') || name.includes('dha')) {
      nutrients.omega3 = Math.round(((nutrients.omega3 || 0) + val) * 10) / 10;
    }
  });

  return {
    id: `usda-${food.fdcId as string}`,
    fdcId: food.fdcId,
    name: (food.description || food.lowercaseDescription || 'Unknown') as string,
    brand: (food.brandOwner || food.brandName || '') as string,
    servingG: (food.servingSize || 100) as number,
    servingUnit: (food.servingSizeUnit || 'g') as string,
    source: 'usda',
    cal: nutrients.cal || 0,
    protein: nutrients.protein || 0,
    carbs: nutrients.carbs || 0,
    fat: nutrients.fat || 0,
    fiber: nutrients.fiber || 0,
    sodium: nutrients.sodium || 0,
    ...nutrients,
  } as FoodItem;
}

async function searchUsda(query: string, pageSize = 20): Promise<FoodItem[]> {
  const cacheKey = `usda-search-${query.toLowerCase().trim()}`;
  const cached = await cacheGet(cacheKey);
  if (cached?.results) return cached.results;
  try {
    const res = await fetch(
      `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${USDA_API_KEY}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json() as { foods?: Record<string, any>[] };
    const results = (data.foods || []).map(normalizeUsda);
    await cacheSet({ id: cacheKey, results, query: query.toLowerCase().trim() } as any);
    return results;
  } catch { return []; }
}

async function getUsdaById(fdcId: string): Promise<FoodItem | null> {
  const cacheKey = `usda-${fdcId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached as FoodItem;
  try {
    const res = await fetch(`${USDA_BASE}/food/${fdcId}?api_key=${USDA_API_KEY}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const food = await res.json() as Record<string, any>;
    const normalized = normalizeUsda(food);
    await cacheSet(normalized as any);
    return normalized;
  } catch { return null; }
}

// ─── Open Food Facts ──────────────────────────────────────────────────────────

function normalizeOff(product: Record<string, any>): FoodItem {
  const n = (product.nutriments || {}) as Record<string, number>;
  return {
    id: `off-${product.code || product._id}`,
    barcode: product.code || product._id,
    name: (product.product_name || product.product_name_en || 'Unknown') as string,
    brand: (product.brands || '') as string,
    servingG: parseFloat(product.serving_quantity) || 100,
    servingUnit: (product.serving_quantity_unit || 'g') as string,
    source: 'off',
    cal: Math.round(n['energy-kcal_100g'] || (n.energy_100g || 0) / 4.184 || 0),
    protein: Math.round((n.proteins_100g || 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * 10) / 10,
    fiber: Math.round((n.fiber_100g || 0) * 10) / 10,
    sodium: Math.round((n.sodium_100g || 0) * 1000),
    sugar: Math.round((n.sugars_100g || 0) * 10) / 10,
    satFat: Math.round((n['saturated-fat_100g'] || 0) * 10) / 10,
    calcium: Math.round((n.calcium_100g || 0) * 1000),
    iron: Math.round((n.iron_100g || 0) * 10000) / 10,
    potassium: Math.round((n.potassium_100g || 0) * 1000),
    vitaminC: Math.round((n['vitamin-c_100g'] || 0) * 1000),
    vitaminD: Math.round((n['vitamin-d_100g'] || 0) * 1000000) / 10,
    allergens: (product.allergens_tags || []) as string[],
    dietaryModes: (product.labels_tags || []) as string[],
    imageUrl: (product.image_small_url || product.image_url || '') as string,
  } as FoodItem;
}

async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const cacheKey = `off-${barcode}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached as FoodItem;
  try {
    const res = await fetch(`${OFF_BASE}/product/${barcode}.json`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { status: number; product?: Record<string, any> };
    if (data.status !== 1 || !data.product) return null;
    const normalized = normalizeOff(data.product);
    await cacheSet(normalized as any);
    return normalized;
  } catch { return null; }
}

async function searchOff(query: string, pageSize = 20): Promise<FoodItem[]> {
  const cacheKey = `off-search-${query.toLowerCase().trim()}`;
  const cached = await cacheGet(cacheKey);
  if (cached?.results) return cached.results;
  try {
    const res = await fetch(
      `${OFF_BASE}/search?search_terms=${encodeURIComponent(query)}&page_size=${pageSize}&json=true` +
      `&fields=code,product_name,brands,nutriments,serving_quantity,serving_size,allergens_tags,labels_tags,image_small_url`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json() as { products?: Record<string, any>[] };
    const results = (data.products || []).map(normalizeOff).filter(f => f.cal > 0 || f.name !== 'Unknown');
    await cacheSet({ id: cacheKey, results, query: query.toLowerCase().trim() } as any);
    return results;
  } catch { return []; }
}

// ─── Unified search ───────────────────────────────────────────────────────────

export const FoodDb = {
  async search(query: string, opts: { pageSize?: number; source?: 'auto' | 'usda' | 'off' } = {}): Promise<FoodItem[]> {
    const q = query.trim();
    if (!q) return [];
    const { pageSize = 20, source = 'auto' } = opts;
    if (source === 'off') return searchOff(q, pageSize);
    if (source === 'usda') return searchUsda(q, pageSize);
    const [usda, off] = await Promise.all([searchUsda(q, pageSize), searchOff(q, Math.min(pageSize, 10))]);
    const seen = new Set(usda.map(f => f.name.toLowerCase()));
    const unique = off.filter(f => !seen.has(f.name.toLowerCase()));
    return [...usda, ...unique].slice(0, pageSize);
  },

  async lookupBarcode(barcode: string): Promise<FoodItem | null> {
    return lookupBarcode(barcode);
  },

  async getById(id: string): Promise<FoodItem | null> {
    if (id.startsWith('usda-')) return getUsdaById(id.replace('usda-', ''));
    return cacheGet(id) as Promise<FoodItem | null>;
  },

  scale(food: FoodItem, grams: number): FoodItem {
    const base = food.servingG || 100;
    const r = grams / base;
    const round1 = (v: number | undefined) => Math.round((v || 0) * r * 10) / 10;
    const roundInt = (v: number | undefined) => Math.round((v || 0) * r);
    return {
      ...food,
      qty: grams,
      cal: roundInt(food.cal),
      protein: round1(food.protein),
      carbs: round1(food.carbs),
      fat: round1(food.fat),
      fiber: round1(food.fiber),
      sodium: roundInt(food.sodium),
      sugar: round1(food.sugar),
      satFat: round1(food.satFat),
      cholesterol: roundInt(food.cholesterol),
      calcium: roundInt(food.calcium),
      iron: round1(food.iron),
      potassium: roundInt(food.potassium),
      magnesium: roundInt(food.magnesium),
      zinc: round1(food.zinc),
      phosphorus: roundInt(food.phosphorus),
      selenium: round1(food.selenium),
      vitaminA: roundInt(food.vitaminA),
      vitaminC: roundInt(food.vitaminC),
      vitaminD: round1(food.vitaminD),
      vitaminE: round1(food.vitaminE),
      vitaminK: round1(food.vitaminK),
      vitaminB12: round1(food.vitaminB12),
      vitaminB6: round1(food.vitaminB6),
      thiamin: round1(food.thiamin),
      riboflavin: round1(food.riboflavin),
      niacin: round1(food.niacin),
      folate: roundInt(food.folate),
      choline: roundInt(food.choline),
      omega3: round1(food.omega3),
    };
  },

  evictStale: cacheEvict,
};
