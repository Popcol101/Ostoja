"use client";
// Udostępnianie linku: Facebook, WhatsApp, SMS, e-mail, kopiowanie i systemowe „Udostępnij” (telefon).
// Same linki – bez skryptów i ciasteczek serwisów społecznościowych na naszej stronie.
import { Check, Copy, Mail, MessageCircle, MessageSquareText, Share2, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

export function shareLinks(url: string, text: string, subject: string) {
  const enc = encodeURIComponent;
  const body = `${text}\n${url}`;
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    whatsapp: `https://wa.me/?text=${enc(body)}`,
    // „sms:?&body=” działa na Androidzie i iOS.
    sms: `sms:?&body=${enc(body)}`,
    email: `mailto:?subject=${enc(subject)}&body=${enc(body)}`,
  };
}

const item =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-brand bg-card px-3 text-[15px] font-semibold text-brand no-underline";

export function ShareButtons({ url, text, subject }: { url: string; text: string; subject: string }) {
  const links = shareLinks(url, text, subject);
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {native ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-4 font-semibold text-white"
          onClick={() => navigator.share({ title: subject, text, url }).catch(() => {})}
        >
          <Share2 size={18} aria-hidden="true" /> Udostępnij…
        </button>
      ) : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Udostępnij klepsydrę">
        <li>
          <a className={`${item} w-full`} href={links.facebook} target="_blank" rel="noopener noreferrer">
            <ThumbsUp size={18} aria-hidden="true" /> Facebook
          </a>
        </li>
        <li>
          <a className={`${item} w-full`} href={links.whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> WhatsApp
          </a>
        </li>
        <li>
          <a className={`${item} w-full`} href={links.sms}>
            <MessageSquareText size={18} aria-hidden="true" /> SMS
          </a>
        </li>
        <li>
          <a className={`${item} w-full`} href={links.email}>
            <Mail size={18} aria-hidden="true" /> E-mail
          </a>
        </li>
      </ul>
      <button
        type="button"
        className={item}
        onClick={() =>
          navigator.clipboard
            .writeText(url)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            })
            .catch(() => {})
        }
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Skopiowano link" : "Kopiuj link"}</span>
      </button>
    </div>
  );
}
