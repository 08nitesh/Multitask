const API = `https://graph.instagram.com/${process.env.GRAPH_VERSION || 'v21.0'}`;

function getAccounts() {
  try {
    return JSON.parse(process.env.ACCOUNTS_JSON || '[]').map((a, i) => ({ id: String(i), ...a }));
  } catch {
    return [];
  }
}

async function graph(method, endpoint, params) {
  const url = new URL(API + endpoint);
  const opts = { method };
  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  } else {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(params);
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers['x-password'] !== pw) return res.status(401).json({ error: 'Wrong password' });

  const b = req.body || {};
  const accounts = getAccounts();
  try {
    if (b.action === 'accounts') {
      return res.json(accounts.map(({ id, name }) => ({ id, name })));
    }
    const acc = accounts.find((a) => a.id === b.accountId);
    if (!acc) return res.status(400).json({ error: 'Unknown account' });

    if (b.action === 'create') {
      const params = {
        media_type: 'REELS',
        video_url: b.videoUrl,
        caption: b.caption || '',
        share_to_feed: String(b.shareToFeed !== false),
        access_token: acc.access_token,
      };
      if (b.thumbOffset) params.thumb_offset = String(Math.round(Number(b.thumbOffset) * 1000));
      if (b.locationId) params.location_id = b.locationId;
      if (b.collaborators?.length) params.collaborators = JSON.stringify(b.collaborators);
      const c = await graph('POST', `/${acc.ig_user_id}/media`, params);
      return res.json({ containerId: c.id });
    }

    if (b.action === 'status') {
      const s = await graph('GET', `/${b.containerId}`, { fields: 'status_code,status', access_token: acc.access_token });
      return res.json({ status: s.status_code, detail: s.status || '' });
    }

    if (b.action === 'publish') {
      const p = await graph('POST', `/${acc.ig_user_id}/media_publish`, { creation_id: b.containerId, access_token: acc.access_token });
      let permalink = null;
      try {
        permalink = (await graph('GET', `/${p.id}`, { fields: 'permalink', access_token: acc.access_token })).permalink;
      } catch {}
      return res.json({ mediaId: p.id, permalink });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
