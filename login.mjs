// netlify/functions/login.mts
function corsHeaders() {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-office-passcode",
    "access-control-allow-methods": "POST, OPTIONS"
  };
}
var login_default = async (req, _context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: corsHeaders() });
  }
  let body = {};
  try {
    body = await req.json();
  } catch {
  }
  const expected = Netlify.env.get("OFFICE_PASSCODE");
  const ok = !expected || body.passcode === expected;
  return new Response(JSON.stringify({ ok }), { status: 200, headers: corsHeaders() });
};
var config = { path: "/api/login" };
export {
  config,
  login_default as default
};
