// Anasayfada öne çıkan yazıları ve site ayarlarını JSON'dan yükler
document.addEventListener('DOMContentLoaded', async () => {

  // ── Featured posts ──
  const blogGrid = document.getElementById('blog-cards-dynamic');
  if (blogGrid) {
    try {
      const res = await fetch('/content/settings/featured.json');
      const posts = await res.json();
      if (posts && posts.length > 0) {
        blogGrid.innerHTML = posts.slice(0, 3).map((p, i) => `
          <div class="blog-card fade${i>0?' d'+i:''}">
            <img src="${p.thumbnail || 'images/blog-kapak.jpg'}" alt="${p.title}" onerror="this.src='images/blog-kapak.jpg'">
            <div class="blog-body">
              <span class="blog-cat">${p.category || ''}</span>
              <h3>${p.title}</h3>
              <p>${p.excerpt || ''}</p>
              <div class="blog-meta">
                <span>Sabah Ezgi Tiryaki</span>
                <span class="blog-meta-dot"></span>
                <span>${p.readtime || 5} dk okuma</span>
              </div>
            </div>
          </div>`).join('');
        // Re-trigger fade animations
        document.querySelectorAll('.fade').forEach(el => {
          el.classList.remove('in');
          setTimeout(() => {
            new IntersectionObserver(([e]) => { if (e.isIntersecting) { e.target.classList.add('in'); } }, { threshold: 0.1 }).observe(el);
          }, 50);
        });
      }
    } catch(e) { /* placeholder yazılar kalır */ }
  }

  // ── Site settings ──
  try {
    const res = await fetch('/content/settings/site.json');
    const s = await res.json();
    // Footer phone
    document.querySelectorAll('[data-site="phone"]').forEach(el => { if(s.phone) el.textContent = s.phone; });
    document.querySelectorAll('[data-site="email"]').forEach(el => { if(s.email) el.textContent = s.email; });
    document.querySelectorAll('[data-site="address"]').forEach(el => { if(s.address) el.textContent = s.address; });
    document.querySelectorAll('[data-site="footer_text"]').forEach(el => { if(s.footer_text) el.textContent = s.footer_text; });
    // WhatsApp links
    if (s.whatsapp) {
      document.querySelectorAll('[data-site="whatsapp"]').forEach(el => {
        el.href = `https://wa.me/${s.whatsapp}`;
      });
    }
    // Instagram
    if (s.instagram) {
      document.querySelectorAll('[data-site="instagram"]').forEach(el => {
        el.href = `https://www.instagram.com/${s.instagram}`;
      });
    }
  } catch(e) { /* mevcut hardcoded değerler kalır */ }
});
