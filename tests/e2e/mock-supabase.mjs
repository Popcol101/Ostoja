// Atrapa Supabase Auth dla testów E2E: /auth/v1/otp i /auth/v1/verify.
// Token „a” × 56 loguje Annę (Dom Pogrzebowy Cisza), każdy inny jest wygasły.
import { createServer } from "node:http";

const ANNA = "00000000-0000-4000-8000-000000000001";
const VALID = "a".repeat(56);
const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.url === "/health") return send(200, { ok: true });
    if (req.headers.apikey !== "test-anon-key") return send(401, { msg: "No API key" });
    const data = body ? JSON.parse(body) : {};
    if (req.method === "POST" && req.url === "/auth/v1/otp") {
      if (data.create_user !== false) return send(400, { msg: "create_user musi być false" });
      return send(200, {});
    }
    if (req.method === "POST" && req.url === "/auth/v1/verify") {
      if (data.type === "email" && data.token_hash === VALID) return send(200, { access_token: "x", user: { id: ANNA } });
      return send(403, { msg: "Email link is invalid or has expired" });
    }
    send(404, {});
  });
}).listen(port, "127.0.0.1");
