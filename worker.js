export default {
  async fetch(request) {
    return new Response(
      JSON.stringify({ ok: true, mensaje: "Nova API funcionando" }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
