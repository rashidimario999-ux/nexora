function toHex(buf) {
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function checkPassword(password, stored) {
  const parts = stored.split(":");
  const salt = fromHex(parts[0]);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  return toHex(bits) === parts[1];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function logLogin(env, email, success, reason) {
  try {
    await env.DB
      .prepare("INSERT INTO login_log (email, success, reason) VALUES (?, ?, ?)")
      .bind(email.slice(0, 200), success ? 1 : 0, reason)
      .run();
  } catch (e) {}
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const user = await context.env.DB
      .prepare("SELECT id, password_hash, status FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user || !(await checkPassword(password, user.password_hash))) {
      await logLogin(context.env, email, false, "wrong email or password");
      return json({ error: "Wrong email or password." }, 401);
    }

    if (user.status === "banned") {
      await logLogin(context.env, email, false, "banned account");
      return json({ error: "This account has been suspended." }, 403);
    }

    await logLogin(context.env, email, true, "ok");
    return json({ ok: true, email: email });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
}
