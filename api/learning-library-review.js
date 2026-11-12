const STAGING_RPC = 'https://kuduxlkmuvongfdqyjoc.supabase.co/rest/v1/rpc/learning_library_review_candidates';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (process.env.VERCEL_ENV !== 'preview') {
        return res.status(404).json({ error: 'Preview endpoint unavailable' });
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) {
        return res.status(401).json({ error: 'Sign in to the staging app' });
    }

    const apiKey = process.env.LEARNING_LIBRARY_STAGING_KEY;
    if (!apiKey?.startsWith('sb_publishable_')) {
        return res.status(503).json({ error: 'Preview is not configured' });
    }

    try {
        // Forward only the caller's JWT. Supabase validates it and applies its existing RLS.
        const upstream = await fetch(STAGING_RPC, {
            headers: { apikey: apiKey, Authorization: authorization },
            redirect: 'error',
            signal: AbortSignal.timeout(8000),
        });
        if ([401, 403, 429].includes(upstream.status)) {
            const retryAfter = upstream.headers.get('retry-after');
            if (upstream.status === 429 && retryAfter) res.setHeader('Retry-After', retryAfter);
            return res.status(upstream.status).json({ error: 'Review candidates unavailable' });
        }
        if (!upstream.ok) {
            return res.status(502).json({ error: 'Staging database unavailable' });
        }
        const rows = await upstream.json();
        return res.status(200).json({ candidates: rows.map(row => ({
            question_id: row.question_id,
            last_answered_at: row.last_answered_at,
            attempt_count: row.attempt_count,
        })) });
    } catch {
        return res.status(502).json({ error: 'Staging database unavailable' });
    }
}
