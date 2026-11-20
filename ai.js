/* Nexora AI: free questions are answered by the keyword rules first.
   Only questions they cannot answer are sent to the AI server (/api/chat). */
const aiRulesOnly = aiReply;
let aiCalls = 0;
let aiLast = 0;
const AI_MAX_CALLS = 15;     // per visit
const AI_GAP_MS = 3000;      // minimum time between AI questions
const AI_REST = 'The AI helper is resting right now. I can still search products, show deals, track orders and explain coupons.';

aiSend = function (text) {
  text = String(text).slice(0, 300);
  const local = aiRulesOnly(text);
  S.ai.push(['u', text]);
  typing = 1;
  paint();
  const finish = (reply, ids) => { S.ai.push(['a', reply, ids || []]); typing = 0; paint(); };

  if (!/^I can search products/.test(local[0])) {
    setTimeout(() => finish(local[0], local[1]), 400);
    return;
  }
  const now = Date.now();
  if (aiCalls >= AI_MAX_CALLS || now - aiLast < AI_GAP_MS) {
    setTimeout(() => finish(aiCalls >= AI_MAX_CALLS ? AI_REST : 'One moment please, then ask again.'), 400);
    return;
  }
  aiCalls++;
  aiLast = now;

  const messages = S.ai.slice(-6).map(m => ({ role: m[0] === 'u' ? 'user' : 'model', text: m[1] }));
  const catalog = P.slice(0, 30).map(p => ({ id: p.id, n: p.n, p: p.p, d: p.d, c: p.c }));

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, catalog })
  })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(d => finish(d.reply || AI_REST, d.ids))
    .catch(() => finish(AI_REST));
};
// updated
// updated 2

