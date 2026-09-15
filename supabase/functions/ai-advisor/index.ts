// AMET AI-Advisor — Supabase Edge Function
//
// Läuft serverseitig, hält den OpenRouter-API-Key als Secret (nie im Client).
// Verify JWT ist standardmäßig an (siehe supabase/config.toml) — nur
// eingeloggte Nutzer der App können diese Funktion aufrufen.
//
// WICHTIG: Diese Funktion rechnet NICHTS selbst nach. Sie bekommt eine
// bereits fertig berechnete, strukturierte Zusammenfassung (siehe js/ai.js:
// computeFinancialSummary) und lässt nur das Sprachmodell eine kurze,
// persönliche Antwort daraus formulieren. Die KI erfindet keine Zahlen.
//
// Deploy:
//   supabase functions deploy ai-advisor
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
// Optional (sonst greifen die Defaults unten):
//   supabase secrets set AI_MODEL_PRIMARY=anthropic/claude-3.5-haiku
//   supabase secrets set AI_MODEL_FALLBACK=openai/gpt-4o-mini,meta-llama/llama-3.1-8b-instruct

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SYSTEM_PROMPT = `Du bist AMET, ein diskreter persönlicher Finanzassistent für eine private Finance-App.

Ton: ruhig, intelligent, direkt, kurz. Standardmäßig EIN Satz. Nur wenn explizit nach Details gefragt wird, darfst du länger antworten.

Du bist NICHT: ein Bankberater, kein Lehrer, kein Motivationscoach, kein übertriebener "Money Guru".

Absolut wichtig: Du bekommst bereits fertig berechnete Finanzdaten als JSON. Du darfst NIEMALS eigene Zahlen erfinden, schätzen oder nachrechnen — nutze ausschließlich die Zahlen aus den bereitgestellten Daten. Wenn eine Information fehlt, sag das ehrlich statt zu raten.

Du bist kein professioneller Finanz- oder Anlageberater — es geht um einen persönlichen Budgetüberblick, nicht um Anlageempfehlungen.

Antworte auf Deutsch, in der "du"-Form.`;

function getModelChain(): string[] {
    const primary = Deno.env.get('AI_MODEL_PRIMARY') || 'anthropic/claude-3.5-haiku';
    const fallbacks = (Deno.env.get('AI_MODEL_FALLBACK') || 'openai/gpt-4o-mini,meta-llama/llama-3.1-8b-instruct')
        .split(',')
        .map(m => m.trim())
        .filter(Boolean);
    return [primary, ...fallbacks];
}

// Ob ein fehlgeschlagener Versuch es wert ist, das nächste Modell in der
// Fallback-Kette zu probieren. Timeouts, 429 (Rate-Limit) und 5xx sind
// typischerweise vorübergehend/modellspezifisch — ein anderes Modell (oder
// derselbe Provider gleich nochmal) kann funktionieren. Ein 4xx wie 400
// (kaputter Request) oder 401/403 (Auth-Problem mit dem API-Key) betrifft
// dagegen JEDEN Modellversuch gleichermaßen — weiterprobieren verschwendet
// nur Zeit und lässt die Fehlermeldung an den Nutzer fälschlich nach
// "alle Modelle down" statt "Request/Key kaputt" aussehen.
class OpenRouterError extends Error {
    retryable: boolean;
    constructor(message: string, retryable: boolean) {
        super(message);
        this.retryable = retryable;
    }
}

async function callOpenRouter(model: string, question: string, summary: unknown, apiKey: string, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let res: Response;
        try {
            res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: `Finanzdaten (JSON, bereits berechnet):\n${JSON.stringify(summary)}\n\nFrage: ${question}` }
                    ],
                    temperature: 0.4,
                    max_tokens: 300
                })
            });
        } catch (err) {
            // Timeout (AbortError) oder Netzwerkfehler — beides vorübergehend.
            const message = err instanceof Error ? err.message : String(err);
            throw new OpenRouterError(`Netzwerkfehler/Timeout: ${message}`, true);
        }

        if (!res.ok) {
            const body = await res.text();
            const retryable = res.status === 429 || res.status >= 500;
            throw new OpenRouterError(`OpenRouter ${res.status}: ${body}`, retryable);
        }

        const json = await res.json();
        const answer = json.choices?.[0]?.message?.content;
        if (!answer) throw new OpenRouterError('Leere Antwort vom Modell', true);
        return answer;
    } finally {
        clearTimeout(timeout);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY ist nicht als Secret gesetzt.' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    let question: string;
    let summary: unknown;
    try {
        const body = await req.json();
        question = body.question;
        summary = body.summary;
        if (!question || typeof question !== 'string') throw new Error('question fehlt');
    } catch {
        return new Response(JSON.stringify({ error: 'Ungültiger Request-Body.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const models = getModelChain();
    const errors: string[] = [];

    for (const model of models) {
        try {
            const answer = await callOpenRouter(model, question, summary, apiKey);
            return new Response(JSON.stringify({ answer, modelUsed: model }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        } catch (err) {
            errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
            // Ein nicht-retrybarer Fehler (z.B. 400 kaputter Request, 401/403
            // Auth) betrifft jedes weitere Modell identisch — sofort abbrechen
            // statt die ganze Fallback-Kette sinnlos durchzuprobieren.
            if (err instanceof OpenRouterError && !err.retryable) break;
        }
    }

    return new Response(JSON.stringify({
        error: 'Alle KI-Modelle nicht erreichbar.',
        details: errors
    }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
});
