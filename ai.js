/* Nexora AI: chats like a general AI assistant.
   Questions about your own orders, coupons, wishlist, balance or VIP are answered
   from the app. Everything else goes to the AI server (/api/chat). */
const aiRulesOnly = aiReply;
let aiCalls = 0;
let aiLast = 0;
const AI_MAX_CALLS = 30;     // per visit
const AI_GAP_MS = 2000;      // minimum time between AI questions
const AI_REST = 'The AI helper is resting right now. Please try again in a little while.';
const AI_APP_TOPICS = /\b(my order|orders|track|delivery|coupon|voucher|promo|wishlist|saved items|balance|wallet|top ?up|vip)\b/i;

const aiStyle = document.createElement('style');
aiStyle.textContent = '.bb{white-space:pre-wrap;overflow-wrap:anywhere}';
document.head.appendChild(aiStyle);

aiSend = function (text) {
  text = String(text).slice(0, 500);
  const local = aiRulesOnly(text);
  const localKnown = !/^I can search products/.test(local[0]);
  S.ai.push(['u', text]);
  typing = 1;
  paint();
  const finish = (reply, ids) => { S.ai.push(['a', reply, ids || []]); typing = 0; paint(); };
  const useLocal = () => finish(localKnown ? local[0] : AI_REST, localKnown ? local[1] : []);

  if (AI_APP_TOPICS.test(text) && localKnown) {
    setTimeout(useLocal, 400);
    return;
  }
  const now = Date.now();
  if (aiCalls >= AI_MAX_CALLS) { setTimeout(useLocal, 400); return; }
  if (now - aiLast < AI_GAP_MS) { setTimeout(() => finish('One moment please, then ask again.'), 400); return; }
  aiCalls++;
  aiLast = now;

  const messages = S.ai.slice(-10).map(m => ({ role: m[0] === 'u' ? 'user' : 'model', text: m[1] }));
  const catalog = P.slice(0, 30).map(p => ({ id: p.id, n: p.n, p: p.p, d: p.d, c: p.c }));

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, catalog })
  })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(d => finish(d.reply || AI_REST, d.ids))
    .catch(useLocal);
};
