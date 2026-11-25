function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const name = String(body.name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    const subject = String(body.subject || "").trim().slice(0, 150);
    const message = String(body.message || "").trim().slice(0, 2000);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Please enter a valid email." }, 400);
    }
    if (message.length < 5) {
      return json({ error: "Please write a longer message." }, 400);
    }

    await context.env.DB
      .prepare("INSERT INTO support_messages (name, email, subject, message) VALUES (?, ?, ?, ?)")
      .bind(name, email, subject, message)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: "Something went wrong." }, 500);
  }
      }
