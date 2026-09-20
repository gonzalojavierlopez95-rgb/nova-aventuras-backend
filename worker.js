const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const SYSTEM_PROMPT = `Sos Nova, un compañero robot que ayuda a niños a crear y vivir historias interactivas.

Reglas:
- Contenido siempre apropiado para niños, positivo y sin violencia real ni temas oscuros.
- Narrás por turnos: describís una situación breve (2 a 4 oraciones) y después le das al niño entre 2 y 3 opciones de qué hacer a continuación.
- Mantenés continuidad con lo que ya pasó en la historia (personajes, lugares, decisiones previas).
- El niño también puede escribir su propia idea en vez de elegir una opción; si lo hace, segui la historia respetando esa idea.
- Respondés SIEMPRE en español, con un tono cálido, entusiasta y sencillo.
- Respondés ÚNICAMENTE con un JSON válido, sin texto adicional, con este formato exacto:
{"texto": "lo que dice Nova", "opciones": ["opción 1", "opción 2", "opción 3"]}`;

async function llamarClaude(env, mensajes) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: mensajes,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || "Error llamando a Claude");
  }

  const textoCrudo = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(textoCrudo);
  } catch {
    return { texto: textoCrudo, opciones: [] };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Endpoint de prueba de la base de datos
    if (url.pathname === "/api/test-db") {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO aventuras (id, nombre_protagonista, genero, historial) VALUES (?, ?, ?, ?)`
      ).bind(id, "Prueba", "aventura", "[]").run();
      const row = await env.DB.prepare(`SELECT * FROM aventuras WHERE id = ?`).bind(id).first();
      return jsonResponse({ ok: true, aventura: row });
    }

    // Iniciar una aventura nueva
    if (url.pathname === "/api/aventura/iniciar" && request.method === "POST") {
      const { genero, nombre } = await request.json();

      const primerMensajeUsuario = `Quiero empezar una aventura de género "${genero}". El nombre de mi personaje/protagonista es "${nombre}". Arrancá la historia.`;

      const respuesta = await llamarClaude(env, [
        { role: "user", content: primerMensajeUsuario },
      ]);

      const id = crypto.randomUUID();
      const historial = [
        { role: "user", content: primerMensajeUsuario },
        { role: "assistant", content: JSON.stringify(respuesta) },
      ];

      await env.DB.prepare(
        `INSERT INTO aventuras (id, nombre_protagonista, genero, historial) VALUES (?, ?, ?, ?)`
      ).bind(id, nombre || "", genero || "", JSON.stringify(historial)).run();

      return jsonResponse({ ok: true, aventuraId: id, ...respuesta });
    }

    // Un turno más de una aventura existente
    if (url.pathname === "/api/aventura/turno" && request.method === "POST") {
      const { aventuraId, decision } = await request.json();

      const row = await env.DB.prepare(`SELECT * FROM aventuras WHERE id = ?`)
        .bind(aventuraId)
        .first();

      if (!row) {
        return jsonResponse({ ok: false, error: "Aventura no encontrada" }, 404);
      }

      const historial = JSON.parse(row.historial || "[]");
      historial.push({ role: "user", content: decision });

      const respuesta = await llamarClaude(env, historial);
      historial.push({ role: "assistant", content: JSON.stringify(respuesta) });

      await env.DB.prepare(
        `UPDATE aventuras SET historial = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(JSON.stringify(historial), aventuraId).run();

      return jsonResponse({ ok: true, ...respuesta });
    }

    return jsonResponse({ ok: true, mensaje: "Nova API funcionando" });
  },
};
