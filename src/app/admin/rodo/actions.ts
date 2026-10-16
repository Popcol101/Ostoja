"use server";
// Wnioski osób (RODO art. 15 i 17). Numer telefonu nie trafia do adresu ani do dziennika (tylko końcówka).
import { z } from "zod";
import { userFacingDbError, withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export type SubjectRow = {
  kind: "zapytanie" | "szkic" | "zlecenie";
  id: string;
  created_at: string;
  home_name: string | null;
  city_name: string | null;
  status: string;
  name: string | null;
};

export type RodoState =
  | { step: "start"; error?: string }
  | { step: "wyniki"; phone: string; rows: SubjectRow[]; exported?: string; erased?: number; error?: string };

const phone = z.string().trim().min(9, { message: "Podaj pełny numer telefonu (9 cyfr)" }).max(20);

async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const message = userFacingDbError(e);
    if (message) return { ok: false, error: message };
    throw e;
  }
}

async function lookup(userId: string, p: string) {
  return withUser(userId, async (tx) => {
    const rows = await tx<(Omit<SubjectRow, "created_at"> & { created_at: Date })[]>`select * from admin_subject_lookup(${p})`;
    return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  });
}

export async function rodoAction(prev: RodoState, formData: FormData): Promise<RodoState> {
  const admin = await requireAdmin();
  const intent = z.enum(["szukaj", "eksport", "usun"]).catch("szukaj").parse(formData.get("intent"));
  const parsed = phone.safeParse(formData.get("phone"));
  if (!parsed.success) return { step: "start", error: parsed.error.issues[0]?.message };
  const p = parsed.data;

  if (intent === "eksport") {
    const res = await run(() =>
      withUser(admin.userId, async (tx) => {
        const [row] = await tx<{ data: unknown }[]>`select admin_subject_export(${p}) as data`;
        return JSON.stringify(row.data, null, 2);
      }),
    );
    if (!res.ok) return { step: "start", error: res.error };
    const rows = prev.step === "wyniki" ? prev.rows : [];
    return { step: "wyniki", phone: p, rows, exported: res.value };
  }

  if (intent === "usun") {
    if (formData.get("potwierdzam") !== "tak") {
      return { ...(prev.step === "wyniki" ? prev : { step: "wyniki", phone: p, rows: [] }), error: "Zaznacz potwierdzenie usunięcia." };
    }
    const res = await run(async () => {
      const n = await withUser(admin.userId, async (tx) => {
        const [row] = await tx<{ n: number }[]>`select admin_subject_erase(${p}) as n`;
        return row.n;
      });
      return { n, rows: await lookup(admin.userId, p) };
    });
    if (!res.ok) return { step: "start", error: res.error };
    return { step: "wyniki", phone: p, rows: res.value.rows, erased: res.value.n };
  }

  const res = await run(() => lookup(admin.userId, p));
  if (!res.ok) return { step: "start", error: res.error };
  return { step: "wyniki", phone: p, rows: res.value };
}
