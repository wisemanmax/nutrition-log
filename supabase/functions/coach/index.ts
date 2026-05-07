import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert nutrition coach embedded in the IronLog nutrition tracking app. You have access to the user's actual logged data and provide personalized, data-driven advice.

RULES:
- Always ground advice in the user's specific data provided in the context
- Be concise but actionable — give specific numbers from their data
- Never provide medical diagnoses; recommend consulting a doctor for health concerns
- Keep responses under 250 words
- Use **bold** for key numbers and action items
- Never make up data the user hasn't provided

RESPONSE FORMAT: plain text with **bold** markers. No lists unless the question asks for them.`;

interface CoachContext {
  goals?: { cal?: number; protein?: number; fiber?: number; water?: number; carbs?: number; fat?: number };
  units?: string;
  profile?: { firstName?: string };
  summary7d?: { cal: number; protein: number; fiber: number; sodium: number; daysLogged: number };
  recentNutrition?: Array<{ date: string; cal: number; protein: number; carbs: number; fat: number; fiber: number }>;
  recentBody?: Array<{ date: string; weight: number; bodyFat?: number }>;
  recentMood?: Array<{ date: string; energy?: number; mood?: number }>;
  recentWater?: Array<{ date: string; count: number }>;
}

function buildUserContext(ctx: CoachContext): string {
  const lines: string[] = [];
  const g = ctx.goals || {};
  const s7 = ctx.summary7d;
  lines.push(`USER: ${ctx.profile?.firstName || 'Anonymous'}, units: ${ctx.units || 'lbs'}`);
  lines.push(`GOALS: cal=${g.cal ?? 2400}, protein=${g.protein ?? 180}g, fiber=${g.fiber ?? 25}g, water=${g.water ?? 8} glasses`);
  if (s7) {
    lines.push(`7-DAY AVG: cal=${s7.cal}, protein=${s7.protein}g, fiber=${s7.fiber}g, sodium=${s7.sodium}mg, days_logged=${s7.daysLogged}/7`);
  }
  if (ctx.recentNutrition?.length) {
    const rows = ctx.recentNutrition.slice(0, 7).map(d => `${d.date}: ${d.cal}kcal P${d.protein}g C${d.carbs}g F${d.fat}g fi${d.fiber}g`).join('\n');
    lines.push(`RECENT NUTRITION (last 7 days):\n${rows}`);
  }
  if (ctx.recentBody?.length) {
    const rows = ctx.recentBody.slice(0, 7).map(b => `${b.date}: ${b.weight}${ctx.units || 'lbs'}${b.bodyFat ? ` bf=${b.bodyFat}%` : ''}`).join('\n');
    lines.push(`RECENT WEIGHT:\n${rows}`);
  }
  if (ctx.recentMood?.length) {
    const rows = ctx.recentMood.map(m => `${m.date}: energy=${m.energy ?? '?'} mood=${m.mood ?? '?'}`).join('\n');
    lines.push(`RECENT MOOD:\n${rows}`);
  }
  if (ctx.recentWater?.length) {
    const rows = ctx.recentWater.map(w => `${w.date}: ${w.count} glasses`).join('\n');
    lines.push(`RECENT WATER:\n${rows}`);
  }
  return lines.join('\n\n');
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
    const { question, context } = await req.json() as { question: string; context: CoachContext };
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'question is required' }), { status: 400 });
    }

    const userContext = buildUserContext(context || {});

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // @ts-ignore: cache_control is a Anthropic beta feature
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `USER DATA CONTEXT:\n${userContext}\n\nQUESTION: ${question}`,
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';

    return new Response(JSON.stringify({ response }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Coach function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
