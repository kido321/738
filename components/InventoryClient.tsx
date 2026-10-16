"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeStock, removeProductImage, saveProduct, setProductActive, uploadProductImage } from "@/app/actions";
import { ItemPhoto } from "@/components/ItemPhoto";
import { CATEGORIES } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

type Sheet = { kind: "edit"; product: Product | null } | { kind: "stock"; product: Product } | null;

export function InventoryClient({ products, isAdmin }: { products: Product[]; isAdmin: boolean }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [filter, setFilter] = useState<"all" | "low" | "off">("all");

  const list = products.filter((p) =>
    filter === "low" ? p.active && p.track_stock && p.stock <= p.low_stock_at : filter === "off" ? !p.active : p.active
  );

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        {(["all", "low", "off"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              filter === f ? "bg-gold text-gold-ink" : "border border-line bg-surface"
            }`}
          >
            {f === "all" ? "On menu" : f === "low" ? "Low stock" : "Turned off"}
          </button>
        ))}
        {isAdmin && (
          <button className="btn-gold ml-auto px-3 py-1.5 text-sm" onClick={() => setSheet({ kind: "edit", product: null })}>
            + Add item
          </button>
        )}
      </div>

      {CATEGORIES.map((c) => {
        const items = list.filter((p) => p.category === c.key);
        if (items.length === 0) return null;
        return (
          <section key={c.key} className="card mb-3 py-2">
            <h2 className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gold">{c.label}</h2>
            <ul className="divide-y divide-line">
              {items.map((p) => {
                const low = p.track_stock && p.stock <= p.low_stock_at;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <ItemPhoto url={p.image_url} category={p.category} name={p.name} className="h-12 w-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="tabular text-xs text-muted">
                        {fmtMoney(p.price)}
                        {isAdmin && p.cost > 0 ? ` · cost ${fmtMoney(p.cost)}` : ""}
                      </div>
                    </div>
                    {p.track_stock ? (
                      <button
                        onClick={() => setSheet({ kind: "stock", product: p })}
                        className={`tabular min-w-16 rounded-xl px-3 py-1.5 text-center text-sm font-bold ${
                          p.stock <= 0 ? "bg-bad/20 text-bad" : low ? "bg-warn/20 text-warn" : "bg-surface-2"
                        }`}
                      >
                        {p.stock}
                        <div className="text-[10px] font-medium opacity-70">in stock</div>
                      </button>
                    ) : (
                      <span className="text-xs text-muted">No count</span>
                    )}
                    {isAdmin && (
                      <button
                        className="rounded-lg px-2 py-1 text-sm text-muted"
                        onClick={() => setSheet({ kind: "edit", product: p })}
                        aria-label={`Edit ${p.name}`}
                      >
                        Edit
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {list.length === 0 && (
        <p className="card mb-3 text-sm text-muted">
          {filter === "low" ? "Nothing is low. Nice." : filter === "off" ? "No items turned off." : "No items yet. Tap + Add item."}
        </p>
      )}

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={() => setSheet(null)}>
          <div
            className="pb-safe mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-surface-3" />
            {sheet.kind === "edit" ? (
              <ProductForm product={sheet.product} onDone={() => setSheet(null)} />
            ) : (
              <StockForm product={sheet.product} isAdmin={isAdmin} onDone={() => setSheet(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const isNew = !product;

  return (
    <form
      className="space-y-3 pb-3"
      action={(form) => {
        setError("");
        start(async () => {
          const res = await saveProduct(form);
          if (!res.ok) return setError(res.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <h2 className="text-lg font-bold">{isNew ? "Add item" : `Edit ${product.name}`}</h2>
      {product ? (
        <PhotoPicker product={product} />
      ) : (
        <p className="text-xs text-muted">You can add a photo after you save the item.</p>
      )}
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <div>
        <label className="label">Name</label>
        <input name="name" className="field" defaultValue={product?.name} required maxLength={60} placeholder="Hennessy VS" />
      </div>
      <div>
        <label className="label">Category</label>
        <select name="category" className="field" defaultValue={product?.category ?? "bottle"}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Sell price</label>
          <input name="price" className="field" inputMode="decimal" defaultValue={product?.price ?? ""} required placeholder="0.00" />
        </div>
        <div>
          <label className="label">Your cost</label>
          <input name="cost" className="field" inputMode="decimal" defaultValue={product?.cost ?? ""} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <div>
            <label className="label">Starting stock</label>
            <input name="stock" className="field" inputMode="numeric" defaultValue="0" />
          </div>
        )}
        <div>
          <label className="label">Low stock alert at</label>
          <input name="low_stock_at" className="field" inputMode="numeric" defaultValue={product?.low_stock_at ?? 3} />
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
        <input type="checkbox" name="track_stock" defaultChecked={product?.track_stock ?? true} className="h-5 w-5 accent-[#f2b544]" />
        <span className="text-sm">
          Count stock for this item
          <span className="block text-xs text-muted">Turn off for things like hookah service or mixed drinks.</span>
        </span>
      </label>
      {error && <p className="rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>
          Cancel
        </button>
        <button className="btn-gold col-span-2" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      {!isNew && (
        <button
          type="button"
          className={`w-full py-2 text-sm font-semibold ${product.active ? "text-bad" : "text-good"}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setProductActive(product.id, !product.active);
              if (!res.ok) return setError(res.error);
              router.refresh();
              onDone();
            })
          }
        >
          {product.active ? "Turn off (hide from Sell screen)" : "Turn back on"}
        </button>
      )}
    </form>
  );
}

function StockForm({ product, isAdmin, onDone }: { product: Product; isAdmin: boolean; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"restock" | "count">("restock");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3 pb-3"
      action={(form) => {
        setError("");
        start(async () => {
          const res = await changeStock(form);
          if (!res.ok) return setError(res.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <div>
        <h2 className="text-lg font-bold">{product.name}</h2>
        <p className="tabular text-sm text-muted">{product.stock} in stock now</p>
      </div>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="mode" value={mode} />
      {isAdmin && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={mode === "restock" ? "btn-gold" : "btn-ghost"} onClick={() => setMode("restock")}>
            Add stock
          </button>
          <button type="button" className={mode === "count" ? "btn-gold" : "btn-ghost"} onClick={() => setMode("count")}>
            Set count
          </button>
        </div>
      )}
      <div>
        <label className="label">{mode === "restock" ? "How many came in?" : "How many are on the shelf?"}</label>
        <input name="amount" className="field" inputMode="numeric" required autoFocus placeholder="0" />
      </div>
      <div>
        <label className="label">Note</label>
        <input name="note" className="field" maxLength={200} placeholder="Optional" />
      </div>
      {error && <p className="rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>
          Cancel
        </button>
        <button className="btn-gold col-span-2" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

// Shrinks a phone photo to a small square-ish JPEG before upload.
async function shrinkPhoto(file: File, max = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.82)
  );
}

function PhotoPicker({ product }: { product: Product }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(product.image_url);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    start(async () => {
      try {
        const small = await shrinkPhoto(file);
        setPreview(URL.createObjectURL(small));
        const form = new FormData();
        form.set("id", product.id);
        form.set("file", new File([small], "photo.jpg", { type: "image/jpeg" }));
        const res = await uploadProductImage(form);
        if (!res.ok) {
          setError(res.error);
          setPreview(product.image_url);
          return;
        }
        router.refresh();
      } catch {
        setError("Could not use that photo. Try another one.");
        setPreview(product.image_url);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <ItemPhoto url={preview} category={product.category} name={product.name} className="h-20 w-20 shrink-0 rounded-2xl" />
      <div className="flex flex-col items-start gap-1.5">
        <label className={`btn-ghost cursor-pointer py-2 text-sm ${pending ? "pointer-events-none opacity-50" : ""}`}>
          {pending ? "Uploading..." : preview ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={pending} />
        </label>
        {preview && !pending && (
          <button
            type="button"
            className="text-xs font-semibold text-bad"
            onClick={() =>
              start(async () => {
                const res = await removeProductImage(product.id);
                if (!res.ok) return setError(res.error);
                setPreview(null);
                router.refresh();
              })
            }
          >
            Remove photo
          </button>
        )}
        {error && <p className="text-xs text-bad">{error}</p>}
      </div>
    </div>
  );
}
