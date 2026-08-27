export default async function handler(req, res) {
  const { code } = req.query;

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const data = await tokenRes.json();

    if (data.access_token) {
      const payload = JSON.stringify({ token: data.access_token, provider: 'github' });
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><body><script>
(function(){
  var p = ${JSON.stringify(payload)};
  function recv(e){ window.opener.postMessage('authorization:github:success:'+p, e.origin); }
  window.addEventListener('message', recv, false);
  window.opener.postMessage('authorizing:github','*');
})();
</script></body></html>`);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><body><script>
window.opener.postMessage('authorization:github:error:${JSON.stringify(data)}','*');
</script></body></html>`);
    }
  } catch (err) {
    res.status(500).send('OAuth hatası: ' + err.message);
  }
}
