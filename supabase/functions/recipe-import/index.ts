// Supabase Edge Function: Recipe URL Import
// Fetches a recipe URL server-side (bypasses CORS), extracts Schema.org JSON-LD,
// then falls back to Claude Haiku for ingredient parsing when JSON-LD is missing.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

interface RecipeIngredient {
  raw: string;
  name: string;
  qty: number;
  unit: string;
}

interface ParsedRecipe {
  name: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  sourceUrl: string;
  image: string;
  parsedBy: 'schema-org' | 'claude-haiku';
}

function extractSchemaOrg(html: string, url: string): ParsedRecipe | null {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of matches) {
    try {
      const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, '').trim());
      const data = Array.isArray(json) ? json.find((d: Record<string, unknown>) => d['@type'] === 'Recipe') : json;
      if (!data || data['@type'] !== 'Recipe') continue;

      const rawIngredients: string[] = data.recipeIngredient ?? [];
      const servings = parseInt(Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield) || 1;

      return {
        name: data.name ?? '',
        description: data.description ?? '',
        servings,
        ingredients: rawIngredients.map((raw: string) => ({ raw, name: raw, qty: 0, unit: 'serving' })),
        sourceUrl: url,
        image: Array.isArray(data.image) ? data.image[0] : (data.image ?? ''),
        parsedBy: 'schema-org',
      };
    } catch { /* skip malformed blocks */ }
  }
  return null;
}

async function parseWithClaude(html: string, url: string): Promise<ParsedRecipe | null> {
  // Extract just the text content (crude but effective)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 4000); // stay within Haiku context

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Extract the recipe from this webpage text. Return ONLY valid JSON matching:
{"name":"...","servings":N,"ingredients":[{"raw":"...","name":"...","qty":N,"unit":"..."}],"description":"..."}

Webpage text:
${text}`,
    }],
  });

  const text2 = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text2.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const parsed = JSON.parse(match[0]);
  return { ...parsed, sourceUrl: url, image: '', parsedBy: 'claude-haiku' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'url required' }), { status: 400 });

    const htmlRes = await fetch(url, {
      headers: { 'User-Agent': 'NutritionLog/1.0 (recipe-importer; +https://nutrition.ironlog.space)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!htmlRes.ok) throw new Error(`Fetch failed: ${htmlRes.status}`);
    const html = await htmlRes.text();

    let recipe = extractSchemaOrg(html, url);
    if (!recipe) recipe = await parseWithClaude(html, url);
    if (!recipe) return new Response(JSON.stringify({ error: 'Could not parse recipe' }), { status: 422 });

    return new Response(JSON.stringify(recipe), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
