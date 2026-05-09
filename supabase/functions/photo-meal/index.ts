import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a nutrition analysis AI. Given a photo of food, identify each distinct food item and estimate its nutritional content.

RULES:
- List each identifiable food item separately
- Estimate serving size in grams based on visual cues
- Provide conservative (realistic) macronutrient estimates
- If a food is unclear, describe it as best you can
- Return ONLY valid JSON — no prose, no markdown fences
- Never claim medical accuracy; these are estimates for logging purposes

OUTPUT FORMAT (strict JSON):
{
  "items": [
    {
      "id": "photo_<name_slug>",
      "name": "<food name>",
      "brand": null,
      "servingG": <number>,
      "cal": <number>,
      "protein": <number>,
      "carbs": <number>,
      "fat": <number>,
      "fiber": <number>,
      "sodium": <number>,
      "confidence": "high|medium|low"
    }
  ],
  "description": "<brief overall meal description>"
}`;

interface FoodItem {
  id: string;
  name: string;
  brand: string | null;
  servingG: number;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  confidence: string;
}

interface PhotoMealResponse {
  items: FoodItem[];
  description?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { image, mediaType = 'image/jpeg' } = await req.json() as { image: string; mediaType?: string };
    if (!image) {
      return new Response(JSON.stringify({ error: 'image is required (base64)' }), { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const safeMediaType = validTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: safeMediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: image,
              },
            },
            {
              type: 'text',
              text: 'Identify all food items in this photo and estimate their nutritional content. Return only JSON.',
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    let parsed: PhotoMealResponse;
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { items: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Photo meal function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', items: [] }), { status: 500 });
  }
});
