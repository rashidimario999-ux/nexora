function toHex(buf) {
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  return toHex(salt) + ":" + toHex(bits);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email.includes("@") || password.length < 8) {
      return json({ error: "Enter a valid email and a password of at least 8 characters." }, 400);
    }

    const hash = await hashPassword(password);
    await context.env.DB
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .bind(email, hash)
      .run();

    return json({ ok: true });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return json({ error: "That email is already registered." }, 400);
    }
    return json({ error: "Something went wrong." }, 500);
  }
}
