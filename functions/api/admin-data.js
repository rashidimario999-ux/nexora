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

    const db = context.env.DB;

    const totals = await db.prepare(
      "SELECT " +
      "(SELECT COUNT(*) FROM users) AS users, " +
      "(SELECT COUNT(*) FROM sellers) AS shops, " +
      "(SELECT COUNT(*) FROM products) AS products, " +
      "(SELECT COUNT(*) FROM orders) AS orders, " +
      "(SELECT COALESCE(SUM(total), 0) FROM orders) AS sales, " +
      "(SELECT COALESCE(SUM(commission), 0) FROM orders) AS commission, " +
      "(SELECT COUNT(*) FROM login_log WHERE success = 0) AS failed_logins, " +
      "(SELECT COUNT(*) FROM support_messages WHERE status = 'open') AS open_support"
    ).first();

    const users = await db.prepare(
      "SELECT id, email, status FROM users ORDER BY id DESC LIMIT 100"
    ).all();

    const shops = await db.prepare(
      "SELECT id, user_id, shop_name, country, status, created_at FROM sellers ORDER BY id DESC LIMIT 100"
    ).all();

    const products = await db.prepare(
      "SELECT products.id, products.name, products.price, products.currency, products.status, sellers.shop_name " +
      "FROM products JOIN sellers ON sellers.id = products.seller_id ORDER BY products.id DESC LIMIT 100"
    ).all();

    const orders = await db.prepare(
      "SELECT orders.id, products.name AS product, orders.quantity, orders.total, orders.commission, orders.currency, orders.status, orders.created_at " +
      "FROM orders JOIN products ON products.id = orders.product_id ORDER BY orders.id DESC LIMIT 100"
    ).all();

    const logins = await db.prepare(
      "SELECT id, email, success, reason, created_at FROM login_log ORDER BY id DESC LIMIT 50"
    ).all();

    const support = await db.prepare(
      "SELECT id, name, email, subject, message, status, created_at FROM support_messages ORDER BY id DESC LIMIT 100"
    ).all();

    return json({
      ok: true,
      totals: totals,
      users: users.results,
      shops: shops.results,
      products: products.results,
      orders: orders.results,
      logins: logins.results,
      support: support.results
    });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
}
