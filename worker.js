export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint de prueba: crea una aventura de ejemplo y la vuelve a leer
    if (url.pathname === "/api/test-db") {
      const id = crypto.randomUUID();

      await env.DB.prepare(
        `INSERT INTO aventuras (id, nombre_protagonista, genero, historial)
         VALUES (?, ?, ?, ?)`
      )
        .bind(id, "Prueba", "aventura", "[]")
        .run();

      const row = await env.DB.prepare(
        `SELECT * FROM aventuras WHERE id = ?`
      )
        .bind(id)
        .first();

      return new Response(JSON.stringify({ ok: true, aventura: row }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, mensaje: "Nova API funcionando" }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
