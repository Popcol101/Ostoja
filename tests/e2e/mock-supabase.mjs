// Atrapy dla testów E2E: Supabase Auth (hasła, Admin API, tokeny do ustawienia hasła) i API Brevo (e-maile).
// Konta trzyma lokalna tabela auth.users (jak prawdziwy Supabase), hasła – pamięć atrapy.
// Anna (Dom Pogrzebowy Cisza) ma na starcie hasło ANNA_PASSWORD; inne konta z seeda haseł nie mają.
// Wysłane e-maile: GET /mock/outbox?to=adres → ostatnia wiadomość na ten adres.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import postgres from "postgres";

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);
// Atrapa działa jak GoTrue (właściciel schematu auth), więc łączy się jako postgres – nie przez rolę aplikacji.
const sql = postgres(process.env.MOCK_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54322/ostoja", { max: 2 });
const passwords = new Map([["00000000-0000-4000-8000-000000000001", "anna-haslo-testowe"]]);
const recovery = new Map(); // token → id konta
const outbox = [];

const userByEmail = async (email) => (await sql`select id from auth.users where lower(email) = lower(${email ?? ""})`)[0]?.id ?? null;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/health") return send(200, { ok: true });
    if (url.pathname === "/mock/outbox") {
      const to = url.searchParams.get("to");
      const mail = [...outbox].reverse().find((m) => m.to === to);
      return mail ? send(200, mail) : send(404, {});
    }
    const data = body ? JSON.parse(body) : {};

    // --- Brevo ---
    if (req.method === "POST" && url.pathname === "/v3/smtp/email") {
      if (req.headers["api-key"] !== "test-brevo-key") return send(401, { code: "unauthorized" });
      if (!data.sender?.email || !data.to?.[0]?.email || !data.htmlContent || !data.textContent) return send(400, { code: "missing_parameter" });
      outbox.push({ to: data.to[0].email, subject: data.subject, html: data.htmlContent, text: data.textContent, tags: data.tags });
      return send(201, { messageId: `<${randomBytes(6).toString("hex")}@mock>` });
    }

    // --- Supabase Auth ---
    const key = req.headers.apikey;
    if (key !== "test-anon-key" && key !== "test-service-key") return send(401, { msg: "No API key" });
    const admin = key === "test-service-key" && req.headers.authorization === "Bearer test-service-key";

    if (req.method === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const id = await userByEmail(data.email);
      if (id && passwords.get(id) === data.password) return send(200, { access_token: "x", user: { id } });
      return send(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
    }
    if (req.method === "POST" && url.pathname === "/auth/v1/verify") {
      const id = data.type === "recovery" ? recovery.get(data.token_hash) : null;
      if (!id) return send(403, { error_code: "otp_expired", msg: "Email link is invalid or has expired" });
      recovery.delete(data.token_hash);
      return send(200, { access_token: "x", user: { id } });
    }
    if (!url.pathname.startsWith("/auth/v1/admin/")) return send(404, {});
    if (!admin) return send(403, { msg: "not admin" });

    if (req.method === "POST" && url.pathname === "/auth/v1/admin/users") {
      if (!data.email || data.email_confirm !== true) return send(400, { msg: "email i email_confirm wymagane" });
      if (typeof data.password !== "string" || data.password.length < 6) return send(422, { error_code: "weak_password" });
      if (await userByEmail(data.email)) return send(422, { error_code: "email_exists" });
      const [u] = await sql`insert into auth.users (id, email) values (gen_random_uuid(), ${data.email}) returning id`;
      passwords.set(u.id, data.password);
      return send(200, { id: u.id, email: data.email });
    }
    const m = url.pathname.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/);
    if (req.method === "PUT" && m) {
      const [u] = await sql`select id from auth.users where id = ${m[1]}`;
      if (!u) return send(404, { msg: "User not found" });
      if (typeof data.password !== "string" || data.password.length < 6) return send(422, { error_code: "weak_password" });
      passwords.set(u.id, data.password);
      return send(200, { id: u.id });
    }
    if (req.method === "POST" && url.pathname === "/auth/v1/admin/generate_link") {
      const id = data.type === "recovery" ? await userByEmail(data.email) : null;
      if (!id) return send(404, { msg: "User not found" });
      const token = randomBytes(28).toString("hex");
      recovery.set(token, id);
      return send(200, { id, email: data.email, properties: { hashed_token: token, verification_type: "recovery" } });
    }
    send(404, {});
  });
}).listen(port, "127.0.0.1");
