// Szyfrowanie sekretów zakładów (np. klucz API programu do faktur) przed zapisem w bazie.
// AES-256-GCM, klucz 32 bajty w base64 w zmiennej INTEGRATIONS_KEY (tylko serwer, nigdy w repozytorium).
// Format: v1.<iv base64url>.<tag base64url>.<szyfrogram base64url>.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.INTEGRATIONS_KEY;
  if (!raw) throw new Error("Brak zmiennej INTEGRATIONS_KEY");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("INTEGRATIONS_KEY musi mieć 32 bajty (base64)");
  return buf;
}

export function integrationsEnabled(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

/** aad wiąże szyfrogram z zakładem: sekretu jednego zakładu nie da się podłożyć innemu. */
export function decryptSecret(token: string, aad: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Nieznany format sekretu");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
