export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, password, post } = req.body;

  /* ── Giriş kontrolü ── */
  if (action === 'login') {
    if (password === process.env.CMS_PASSWORD) {
      return res.json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: 'Yanlış şifre' });
  }

  /* ── Yazı yayınla ── */
  if (action === 'publish') {
    if (password !== process.env.CMS_PASSWORD) {
      return res.status(401).json({ error: 'Yetkisiz' });
    }

    const date = new Date().toISOString().split('T')[0];
    const slug = (post.title || 'yazi')
      .toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-').slice(0, 60);

    const filename = `${date}-${slug}.md`;
    const mdContent = [
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

    const b64 = Buffer.from(mdContent, 'utf8').toString('base64');

    const ghRes = await fetch(
      `https://api.github.com/repos/ismailipek11/sabah-ezgi-site/contents/content/posts/${filename}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Blog: ${post.title}`,
          content: b64
        })
      }
    );

    if (ghRes.ok) return res.json({ ok: true, filename });
    const err = await ghRes.json();
    return res.status(500).json({ ok: false, error: err.message });
  }

  res.status(400).json({ error: 'Geçersiz işlem' });
}
