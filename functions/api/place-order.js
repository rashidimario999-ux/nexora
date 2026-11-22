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

const COMMISSION_PERCENT = 10;

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const productId = Number(body.product_id);
    const quantity = Math.floor(Number(body.quantity || 1));

    if (!productId || !(quantity >= 1 && quantity <= 100)) {
      return json({ error: "Please choose a product and a quantity from 1 to 100." }, 400);
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

    const product = await context.env.DB
      .prepare(
        "SELECT products.id, products.price, products.currency, products.seller_id, sellers.user_id AS seller_user " +
        "FROM products JOIN sellers ON sellers.id = products.seller_id " +
        "WHERE products.id = ? AND products.status = 'active' AND sellers.status = 'active'"
      )
      .bind(productId)
      .first();

    if (!product) {
      return json({ error: "This product is not available." }, 404);
    }

    if (product.seller_user === user.id) {
      return json({ error: "You cannot buy from your own shop." }, 400);
    }

    const total = Math.round(product.price * quantity * 100) / 100;
    const commission = Math.round(total * COMMISSION_PERCENT) / 100;

    await context.env.DB
      .prepare(
        "INSERT INTO orders (buyer_id, seller_id, product_id, quantity, unit_price, currency, total, commission) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(user.id, product.seller_id, product.id, quantity, product.price, product.currency, total, commission)
      .run();

    return json({ ok: true, total: total, currency: product.currency });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
      }
