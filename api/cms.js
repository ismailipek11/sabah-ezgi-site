export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, password, post, filename } = req.body;
  const REPO = 'ismailipek11/sabah-ezgi-site';
  const FOLDER = 'content/posts';
  const TOKEN = process.env.GITHUB_TOKEN;
  const headers = { Authorization: `token ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' };

  /* ── Şifre kontrolü ── */
  if (action === 'login') {
    return password === process.env.CMS_PASSWORD
      ? res.json({ ok: true })
      : res.status(401).json({ ok: false, error: 'Yanlış şifre' });
  }

  if (password !== process.env.CMS_PASSWORD) return res.status(401).json({ error: 'Yetkisiz' });

  /* ── Yazıları listele ── */
  if (action === 'list') {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}`, { headers });
    if (!r.ok) return res.json({ ok: true, files: [] });
    const files = await r.json();
    const posts = files
      .filter(f => f.name.endsWith('.md'))
      .map(f => ({ name: f.name, sha: f.sha }));
    return res.json({ ok: true, files: posts });
  }

  /* ── Yazı getir ── */
  if (action === 'get') {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}/${filename}`, { headers });
    if (!r.ok) return res.status(404).json({ error: 'Bulunamadı' });
    const data = await r.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return res.json({ ok: true, content, sha: data.sha });
  }

  /* ── Yeni yazı yayınla ── */
  if (action === 'publish') {
    const date = new Date().toISOString().split('T')[0];
    const slug = (post.title || 'yazi').toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-').slice(0,60);
    const fname = `${date}-${slug}.md`;
    const md = buildMd(post, date);
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}/${fname}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Blog: ${post.title}`, content: Buffer.from(md).toString('base64') })
    });
    if (r.ok) return res.json({ ok: true, filename: fname });
    const err = await r.json();
    return res.status(500).json({ ok: false, error: err.message });
  }

  /* ── Mevcut yazıyı güncelle ── */
  if (action === 'update') {
    const date = filename.slice(0, 10);
    const md = buildMd(post, date);
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}/${filename}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Güncelleme: ${post.title}`, content: Buffer.from(md).toString('base64'), sha: post.sha })
    });
    if (r.ok) return res.json({ ok: true });
    const err = await r.json();
    return res.status(500).json({ ok: false, error: err.message });
  }

  /* ── Yazı sil ── */
  if (action === 'delete') {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}/${filename}`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ message: `Silindi: ${filename}`, sha: post.sha })
    });
    if (r.ok) return res.json({ ok: true });
    return res.status(500).json({ ok: false, error: 'Silinemedi' });
  }

  res.status(400).json({ error: 'Geçersiz işlem' });
}

function buildMd(post, date) {
  return [
    '---',
    `title: "${post.title}"`,
    `date: ${date}`,
    `category: "${post.category}"`,
    `excerpt: "${post.excerpt}"`,
    `readtime: ${post.readtime || 5}`,
    '---',
    '',
    post.body
  ].join('\n');
}
