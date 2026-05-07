import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a professional dietitian creating personalized meal plans.
Generate a 7-day meal plan in strict JSON format.

RULES:
- Each day must have Breakfast, Lunch, Dinner, and Snacks
- All meals must comply with provided dietary modes and avoid listed allergens
- Hit calorie and protein targets within ±10%
- Use practical, easy-to-find ingredients
- Include estimated macros for each meal
- Also generate a grocery list sorted by ingredient

OUTPUT FORMAT (strict JSON, no markdown):
{
  "plan": {
    "YYYY-MM-DD": {
      "Breakfast": { "type": "custom", "name": "...", "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0 } },
      "Lunch": { "type": "custom", "name": "...", "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0 } },
      "Dinner": { "type": "custom", "name": "...", "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0 } },
      "Snacks": { "type": "custom", "name": "...", "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0 } }
    }
  },
  "groceryList": [
    { "name": "...", "servings": 1, "unit": "unit" }
  ],
  "weeklyMacros": { "avgCal": 0, "avgProtein": 0, "avgCarbs": 0, "avgFat": 0 }
}`;

interface Goals {
  cal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

interface MealPlanRequest {
  goals?: Goals;
  dietaryModes?: string[];
  allergens?: string[];
  daysCount?: number;
  startDate?: string;
}

function getWeekDates(startDate?: string, count = 7): string[] {
  const start = startDate ? new Date(startDate) : new Date();
  const dow = start.getDay();
  const monday = new Date(start);
  monday.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
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
    const body = await req.json() as MealPlanRequest;
    const { goals = {}, dietaryModes = [], allergens = [], daysCount = 7, startDate } = body;

    const dates = getWeekDates(startDate, daysCount);
    const calTarget = goals.cal ?? 2400;
    const protTarget = goals.protein ?? 180;

    const userPrompt = [
      `Generate a ${daysCount}-day meal plan for these dates: ${dates.join(', ')}`,
      `Daily targets: ${calTarget} kcal, ${protTarget}g protein${goals.carbs ? `, ${goals.carbs}g carbs` : ''}${goals.fat ? `, ${goals.fat}g fat` : ''}`,
      dietaryModes.length > 0 ? `Dietary modes: ${dietaryModes.join(', ')}` : '',
      allergens.length > 0 ? `AVOID these allergens: ${allergens.join(', ')}` : '',
      'Return only valid JSON, no extra text.',
    ].filter(Boolean).join('\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // @ts-ignore: cache_control is a beta feature
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    let parsed;
    try {
      const clean = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { plan: {}, groceryList: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Meal plan function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', plan: {}, groceryList: [] }), { status: 500 });
  }
});
