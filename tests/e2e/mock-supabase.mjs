// Atrapa Supabase Auth dla testów E2E: /auth/v1/otp, /auth/v1/verify i /auth/v1/admin/users.
// Token „a” × 56 loguje Annę (Dom Pogrzebowy Cisza); „c” × 56 loguje ostatnio założone konto
// (zaproszony pracownik albo nowy partner); każdy inny jest wygasły.
// Admin API zakłada konto w lokalnej tabeli auth.users – tak jak robi to prawdziwy Supabase.
import { createServer } from "node:http";
import postgres from "postgres";

const ANNA = "00000000-0000-4000-8000-000000000001";
const VALID = "a".repeat(56);
const VALID_NEW = "c".repeat(56);
const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);
// Atrapa działa jak GoTrue (właściciel schematu auth), więc łączy się jako postgres – nie przez rolę aplikacji.
const sql = postgres(process.env.MOCK_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54322/ostoja", { max: 2 });
let lastCreated = null;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.url === "/health") return send(200, { ok: true });
    const key = req.headers.apikey;
    if (key !== "test-anon-key" && key !== "test-service-key") return send(401, { msg: "No API key" });
    const data = body ? JSON.parse(body) : {};
    if (req.method === "POST" && req.url === "/auth/v1/otp") {
      if (data.create_user !== false) return send(400, { msg: "create_user musi być false" });
      return send(200, {});
    }
    if (req.method === "POST" && req.url === "/auth/v1/verify") {
      if (data.type === "email" && data.token_hash === VALID) return send(200, { access_token: "x", user: { id: ANNA } });
      if (data.type === "email" && data.token_hash === VALID_NEW && lastCreated) return send(200, { access_token: "x", user: { id: lastCreated } });
      return send(403, { msg: "Email link is invalid or has expired" });
    }
    if (req.method === "POST" && req.url === "/auth/v1/admin/users") {
      if (key !== "test-service-key" || req.headers.authorization !== "Bearer test-service-key") return send(403, { msg: "not admin" });
      if (!data.email || data.email_confirm !== true) return send(400, { msg: "email i email_confirm wymagane" });
      try {
        const [u] = await sql`insert into auth.users (id, email) values (gen_random_uuid(), ${data.email}) returning id`;
        lastCreated = u.id;
        return send(200, { id: u.id, email: data.email });
      } catch {
        return send(422, { msg: "A user with this email address has already been registered" });
      }
    }
    send(404, {});
  });
}).listen(port, "127.0.0.1");
