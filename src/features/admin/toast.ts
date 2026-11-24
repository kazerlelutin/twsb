import { createRoot, createSignal } from "solid-js";

export type Toast = { id: number; text: string; tone: "success" | "danger" };

export const toasts = createRoot(() => {
  const [list, setList] = createSignal<Toast[]>([]);
  let next = 0;
  const push = (text: string, tone: Toast["tone"] = "success") => {
    const id = next++;
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  };
  return { list, push };
});

export const notify = (text: string) => toasts.push(text, "success");
export const notifyError = (error: unknown) =>
  toasts.push(error instanceof Error ? error.message : String(error), "danger");
