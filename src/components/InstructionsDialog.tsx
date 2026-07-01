import { useEffect, useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyInstructions, saveMyInstructions } from "@/lib/instructions.functions";

const MAX = 2000;

export function InstructionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useServerFn(getMyInstructions);
  const save = useServerFn(saveMyInstructions);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load({})
      .then((r) => setValue(r?.content ?? ""))
      .catch(() => toast.error("Couldn't load your instructions."))
      .finally(() => setLoading(false));
  }, [open, load]);

  if (!open) return null;

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { content: value } });
      toast.success("Instructions saved.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[var(--shadow-deep)]">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-glow" />
          <h2 className="flex-1 font-display text-lg tracking-tight">Custom instructions</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Tell Elliot how you'd like him to respond. Applied to every conversation.
        </p>
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX))}
            placeholder={
              loading
                ? "Loading…"
                : "e.g. Call me Charlie. Prefer concise answers. I'm a student — explain code carefully."
            }
            disabled={loading || saving}
            rows={7}
            className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
          <div className="mt-1 text-right text-[10px] text-muted-foreground/70">
            {value.length}/{MAX}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground transition hover:bg-card/60"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={loading || saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-ember)] transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: "var(--gradient-ember)" }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
