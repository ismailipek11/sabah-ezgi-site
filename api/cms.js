const REPO = 'ismailipek11/sabah-ezgi-site';

function ghHeaders() {
  return {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json'
  };
}

async function ghGet(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { headers: ghHeaders() });
  if (!r.ok) return null;
  const d = await r.json();
  if (Array.isArray(d)) return { files: d };
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function ghPut(path, content, sha, message) {
  const body = { message, content: Buffer.from(content, 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body)
  });
  return { ok: r.ok, data: await r.json() };
}

async function ghPutBinary(path, base64, sha, message) {
  const body = { message, content: base64 };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body)
  });
  return { ok: r.ok };
}

async function ghDelete(path, sha, message) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'DELETE', headers: ghHeaders(), body: JSON.stringify({ message, sha })
  });
  return r.ok;
}

function slugify(text) {
  return (text || 'yazi').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,60);
}

function buildMd(post, date) {
  return [
    '---',
    `title: "${(post.title||'').replace(/"/g,"'")}"`,
    `date: ${date}`,
    `slug: "${post.slug || slugify(post.title)}"`,
    `category: "${post.category||''}"`,
    `excerpt: "${(post.excerpt||'').replace(/"/g,"'")}"`,
    `readtime: ${post.readtime||5}`,
    `featured_image: "${post.featured_image||''}"`,
    `featured: ${post.featured ? 'true' : 'false'}`,
    '---',
    '',
    post.body || ''
  ].join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  const { action, password } = body;

  /* ── LOGIN ── */
  if (action === 'login') {
    return password === process.env.CMS_PASSWORD
      ? res.json({ ok: true })
      : res.status(401).json({ ok: false, error: 'Yanlış şifre' });
  }

  if (password !== process.env.CMS_PASSWORD) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }

  /* ── POSTS: LIST ── */
  if (action === 'list') {
    const d = await ghGet('content/posts');
    if (!d || !d.files) return res.json({ ok: true, files: [] });
    const files = d.files
      .filter(f => f.name.endsWith('.md'))
      .map(f => ({ name: f.name, sha: f.sha }))
      .reverse();
    return res.json({ ok: true, files });
  }

  /* ── POSTS: GET ── */
  if (action === 'get') {
    const d = await ghGet(`content/posts/${body.filename}`);
    if (!d) return res.status(404).json({ error: 'Bulunamadı' });
    return res.json({ ok: true, content: d.content, sha: d.sha });
  }

  /* ── POSTS: PUBLISH (new) ── */
  if (action === 'publish') {
    const { post } = body;
    const date = new Date().toISOString().split('T')[0];
    const slug = post.slug || slugify(post.title);
    const filename = `${date}-${slug}.md`;
    const md = buildMd(post, date);
    const r = await ghPut(`content/posts/${filename}`, md, null, `Blog: ${post.title}`);
    if (!r.ok) return res.status(500).json({ ok: false, error: r.data?.message || 'Hata' });

    // Update featured.json if featured
    if (post.featured) await updateFeatured(post, date, filename, 'add');
    return res.json({ ok: true, filename });
  }

  /* ── POSTS: UPDATE ── */
  if (action === 'update') {
    const { post, filename } = body;
    const date = filename.slice(0, 10);
    const md = buildMd(post, date);
    const r = await ghPut(`content/posts/${filename}`, md, post.sha, `Güncelleme: ${post.title}`);
    if (!r.ok) return res.status(500).json({ ok: false, error: r.data?.message || 'Hata' });
    await updateFeatured(post, date, filename, post.featured ? 'add' : 'remove');
    return res.json({ ok: true });
  }

  /* ── POSTS: DELETE ── */
  if (action === 'delete') {
    const { filename, sha } = body;
    const ok = await ghDelete(`content/posts/${filename}`, sha, `Silindi: ${filename}`);
    if (ok) await updateFeatured({}, '', filename, 'remove');
    return res.json({ ok });
  }

  /* ── IMAGE UPLOAD ── */
  if (action === 'upload-image') {
    const { image } = body; // { name, data: 'base64 with data URI prefix' }
    const clean = image.data.replace(/^data:image\/\w+;base64,/, '');
    const ext = image.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const r = await ghPutBinary(`images/blog/${filename}`, clean, null, `Görsel: ${filename}`);
    if (!r.ok) return res.status(500).json({ ok: false, error: 'Yükleme başarısız' });
    return res.json({ ok: true, url: `/images/blog/${filename}` });
  }

  /* ── CATEGORIES ── */
  if (action === 'get-categories') {
    const d = await ghGet('content/settings/categories.json');
    const cats = d ? JSON.parse(d.content) : [];
    return res.json({ ok: true, categories: cats, sha: d?.sha });
  }
  if (action === 'save-categories') {
    const { categories, sha } = body;
    const r = await ghPut('content/settings/categories.json', JSON.stringify(categories, null, 2), sha, 'Kategoriler güncellendi');
    return res.json({ ok: r.ok });
  }

  /* ── SITE SETTINGS ── */
  if (action === 'get-settings') {
    const d = await ghGet('content/settings/site.json');
    const settings = d ? JSON.parse(d.content) : {};
    return res.json({ ok: true, settings, sha: d?.sha });
  }
  if (action === 'save-settings') {
    const { settings, sha } = body;
    const r = await ghPut('content/settings/site.json', JSON.stringify(settings, null, 2), sha, 'Site ayarları güncellendi');
    return res.json({ ok: r.ok });
  }

  /* ── FEATURED ── */
  if (action === 'get-featured') {
    const d = await ghGet('content/settings/featured.json');
    const featured = d ? JSON.parse(d.content) : [];
    return res.json({ ok: true, featured, sha: d?.sha });
  }

  res.status(400).json({ error: 'Geçersiz işlem' });
}

async function updateFeatured(post, date, filename, mode) {
  try {
    const d = await ghGet('content/settings/featured.json');
    let featured = d ? JSON.parse(d.content) : [];
    featured = featured.filter(f => f.filename !== filename);
    if (mode === 'add') {
      featured.unshift({
        filename,
        title: post.title,
        excerpt: post.excerpt || '',
        category: post.category || '',
        date,
        readtime: post.readtime || 5,
        thumbnail: post.featured_image || '',
        slug: post.slug || slugify(post.title)
      });
    }
    await ghPut('content/settings/featured.json', JSON.stringify(featured, null, 2), d?.sha, 'Featured güncellendi');
  } catch(e) { /* sessizce geç */ }
}
