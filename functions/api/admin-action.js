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

const RULES = {
  user: { table: "users", allowed: ["active", "banned"] },
  shop: { table: "sellers", allowed: ["active", "suspended"] },
  product: { table: "products", allowed: ["active", "suspended"] },
  order: { table: "orders", allowed: ["pending", "paid", "shipped", "delivered", "cancelled"] },
  support: { table: "support_messages", allowed: ["open", "solved"] }
};

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const adminEmail = String(context.env.ADMIN_EMAIL || "").trim().toLowerCase();

    if (!adminEmail || email !== adminEmail) {
      return json({ error: "Not allowed." }, 403);
    }

    const user = await context.env.DB
      .prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user || !(await checkPassword(password, user.password_hash))) {
      return json({ error: "Not allowed." }, 403);
    }

    const kind = String(body.kind || "");
    const rule = RULES[kind];
    const id = Number(body.id);
    const status = String(body.status || "");

    if (!rule || !id || !rule.allowed.includes(status)) {
      return json({ error: "Invalid request." }, 400);
    }

    if (kind === "user" && id === user.id) {
      return json({ error: "You cannot change your own account." }, 400);
    }

    await context.env.DB
      .prepare("UPDATE " + rule.table + " SET status = ? WHERE id = ?")
      .bind(status, id)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
    }
