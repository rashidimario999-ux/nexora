function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestGet(context) {
  try {
    const result = await context.env.DB
      .prepare(
        "SELECT products.id, products.name, products.description, products.price, products.currency, sellers.shop_name, sellers.country " +
        "FROM products " +
        "JOIN sellers ON sellers.id = products.seller_id " +
        "WHERE products.status = 'active' AND sellers.status = 'active' " +
        "ORDER BY products.id DESC LIMIT 50"
      )
      .all();

    return json({ ok: true, products: result.results });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
}
