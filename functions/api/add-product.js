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

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const currency = String(body.currency || "USD").trim().toUpperCase();
    const price = Number(body.price);

    if (name.length < 2) {
      return json({ error: "Please enter a product name." }, 400);
    }
    if (!(price > 0)) {
      return json({ error: "Please enter a price above zero." }, 400);
    }

    const user = await context.env.DB
      .prepare("SELECT id, password_hash, status FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user || !(await checkPassword(password, user.password_hash))) {
      return json({ error: "Wrong email or password." }, 401);
    }

    if (user.status === "banned") {
      return json({ error: "This account has been suspended." }, 403);
    }

    const seller = await context.env.DB
      .prepare("SELECT id, status FROM sellers WHERE user_id = ?")
      .bind(user.id)
      .first();

    if (!seller) {
      return json({ error: "Open a shop first." }, 403);
    }

    if (seller.status !== "active") {
      return json({ error: "This shop is suspended." }, 403);
    }

    await context.env.DB
      .prepare("INSERT INTO products (seller_id, name, description, price, currency) VALUES (?, ?, ?, ?, ?)")
      .bind(seller.id, name, description, price, currency)
      .run();

    return json({ ok: true, name: name });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
                         }
