"use client";
// Zdjęcie grobu z aparatu telefonu. Z JS zmniejszamy je w przeglądarce (najdłuższy bok 1600 px, JPEG),
// żeby wysyłka w terenie była szybka i mieściła się w limicie. Bez JS idzie oryginał (do 3 MB).
import { useRef, useState } from "react";

export function PhotoInput({ id }: { id: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState("");

  async function shrink() {
    const input = ref.current;
    const file = input?.files?.[0];
    if (!input || !file || !file.type.startsWith("image/")) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) return;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "grob.jpg", { type: "image/jpeg" }));
      input.files = dt.files;
      setInfo(`Zdjęcie gotowe (${Math.round(blob.size / 1024)} KB).`);
    } catch {
      setInfo(file.size > 3_000_000 ? "Zdjęcie jest za duże. Zrób nowe w mniejszej rozdzielczości." : "");
    }
  }

  return (
    <>
      <input
        ref={ref}
        id={id}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        required
        onChange={shrink}
        className="block w-full text-[15px] file:mr-3 file:min-h-11 file:rounded-[10px] file:border-[1.5px] file:border-brand file:bg-card file:px-4 file:font-semibold file:text-brand"
      />
      <p role="status" className="text-sm text-muted">
        {info}
      </p>
    </>
  );
}
