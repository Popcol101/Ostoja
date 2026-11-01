// Wspólny kształt danych faktury, niezależny od programu do faktur.
export type VatRate = "8" | "23" | "zw";

export type InvoiceDraft = {
  issueDate: string; // RRRR-MM-DD (data wystawienia i sprzedaży)
  paymentDue: string; // RRRR-MM-DD
  buyer: { firstName: string; lastName: string; street: string; postCode: string; city: string; email: string | null };
  positions: { name: string; grossPln: number }[];
  vat: VatRate;
  description: string; // np. „Koszty pogrzebu: Jan Kowalski” – ZUS sprawdza, czego dotyczy rachunek
  sendToKsef: boolean;
};

export type IssueResult =
  | { ok: true; externalId: string; number: string | null; viewUrl: string | null; ksefStatus: string | null; ksefNumber: string | null }
  | { ok: false; retry: boolean; error: string };

export type KsefStatus = { ksefStatus: string | null; ksefNumber: string | null };

export interface InvoicingProvider {
  issue(draft: InvoiceDraft): Promise<IssueResult>;
  ksefStatus(externalId: string): Promise<KsefStatus | null>;
}
