// Supabase Edge Function: AI Nutrition Coach
// Uses Claude Sonnet with prompt caching over the last 90 days of user data.
// API key stays server-side — never shipped to the client.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

interface CoachRequest {
  question: string;
  context: {
    goals: Record<string, number>;
    last90Days: Array<{
      date: string;
      cal: number; protein: number; carbs: number; fat: number; fiber: number;
    }>;
    recentBody: Array<{
      date: string;
      weight: number | null;
      bodyFat: number | null;
    }>;
    profile: {
      activityLevel?: string;
      dietaryModes?: string[];
      allergens?: string[];
      units?: string;
    };
  };
}

const SYSTEM_PROMPT = `You are a certified sports nutritionist and evidence-based health coach embedded in NutritionLog, a personal nutrition tracking app. You have access to the user's last 90 days of nutrition and body-composition data.

Rules:
- Base all advice on the user's actual logged data, not general platitudes
- Cite specific numbers from their data when relevant
- Be concise: max 3 short paragraphs per response
- Never diagnose medical conditions or replace professional medical advice
- If asked something outside nutrition/fitness, politely redirect
- Use markdown sparingly (bold for key numbers, bullets for lists)
- Always end with one concrete, actionable next step`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const body: CoachRequest = await req.json();
    const { question, context } = body;

    // Build a compact data summary for the prompt
    const last7 = context.last90Days.slice(-7);
    const avgCal = last7.length
      ? Math.round(last7.reduce((s, d) => s + d.cal, 0) / last7.length)
      : 0;
    const avgProt = last7.length
      ? Math.round(last7.reduce((s, d) => s + d.protein, 0) / last7.length)
      : 0;
    const latestWeight = context.recentBody.find(b => b.weight != null)?.weight;

    const dataSummary = `
User data summary (last 7 days logged):
- Avg calories: ${avgCal} kcal (goal: ${context.goals.cal ?? 2400})
- Avg protein: ${avgProt}g (goal: ${context.goals.protein ?? 180}g)
- Avg carbs: ${Math.round(last7.reduce((s, d) => s + d.carbs, 0) / (last7.length || 1))}g
- Avg fat: ${Math.round(last7.reduce((s, d) => s + d.fat, 0) / (last7.length || 1))}g
- Days logged this week: ${last7.length}/7
- Latest weight: ${latestWeight ? latestWeight + ' ' + (context.profile.units ?? 'lbs') : 'not logged'}
- Activity level: ${context.profile.activityLevel ?? 'moderate'}
- Dietary modes: ${(context.profile.dietaryModes ?? []).join(', ') || 'none set'}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Cache the static system prompt across requests
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: dataSummary,
          // Cache the user context across multiple turns in the same session
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: question }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return new Response(JSON.stringify({ response: text }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('AI Coach error:', err);
    return new Response(JSON.stringify({ error: 'Coach unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
