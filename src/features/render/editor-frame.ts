/**
 * Script injecté dans l'aperçu de l'éditeur (iframe) : sélection, barre d'outils,
 * glisser-déposer, poignées de redimensionnement, édition directe des textes
 * et raccourcis clavier. La fonction est sérialisée : elle ne doit rien importer.
 */
export function editorFrame() {
  const doc = document;
  const win = window;
  const post = (data: Record<string, unknown>) =>
    parent.postMessage({ source: "ws-preview", ...data }, "*");
  const blockOf = (node: EventTarget | null) =>
    node instanceof Element
      ? (node.closest("[data-ws-block]") as HTMLElement | null)
      : null;
  const byId = (id: string | null) =>
    id
      ? (doc.querySelector(
          `[data-ws-block="${CSS.escape(id)}"]`,
        ) as HTMLElement | null)
      : null;
  const typeOf = (el: Element | null) => el?.getAttribute("data-ws-type") ?? "";

  let selected: string | null = null;
  let editing: HTMLElement | null = null;
  let editingOriginal = "";
  let dragging:
    | { kind: "move"; id: string }
    | { kind: "insert"; type: string }
    | null = null;
  let resizing = false;

  const ui = doc.createElement("div");
  ui.className = "wse";
  ui.innerHTML = `
    <div class="wse-toolbar" hidden>
      <span class="wse-grip" draggable="true" title="Glisser pour déplacer">⠿ <span class="wse-name"></span></span>
      <button type="button" data-act="parent" title="Sélectionner le parent (Échap)">⤒</button>
      <button type="button" data-act="up" title="Monter (Alt+↑)">↑</button>
      <button type="button" data-act="down" title="Descendre (Alt+↓)">↓</button>
      <button type="button" data-act="duplicate" title="Dupliquer (Ctrl+D)">⧉</button>
      <button type="button" data-act="delete" title="Supprimer (Suppr)">✕</button>
    </div>
    <div class="wse-handle wse-handle--e" title="Largeur (double-clic : réinitialiser)" hidden></div>
    <div class="wse-handle wse-handle--s" title="Hauteur (double-clic : réinitialiser)" hidden></div>
    <div class="wse-gutters"></div>
    <div class="wse-drop" hidden></div>
    <div class="wse-bubble" hidden>
      <button type="button" data-cmd="bold" title="Gras"><b>G</b></button>
      <button type="button" data-cmd="italic" title="Italique"><i>I</i></button>
      <button type="button" data-cmd="underline" title="Souligné"><u>S</u></button>
      <button type="button" data-cmd="insertUnorderedList" title="Liste">•</button>
      <button type="button" data-cmd="createLink" title="Lien">⛓</button>
      <button type="button" data-cmd="removeFormat" title="Effacer la mise en forme">⌫</button>
      <form class="wse-link" hidden><input type="text" inputmode="url" placeholder="https://… puis Entrée" aria-label="Adresse du lien"></form>
    </div>`;
  doc.body.appendChild(ui);
  const toolbar = ui.querySelector(".wse-toolbar") as HTMLElement;
  const grip = ui.querySelector(".wse-grip") as HTMLElement;
  const handleE = ui.querySelector(".wse-handle--e") as HTMLElement;
  const handleS = ui.querySelector(".wse-handle--s") as HTMLElement;
  const gutters = ui.querySelector(".wse-gutters") as HTMLElement;
  const drop = ui.querySelector(".wse-drop") as HTMLElement;
  const bubble = ui.querySelector(".wse-bubble") as HTMLElement;
  const linkForm = ui.querySelector(".wse-link") as HTMLFormElement;
  const linkInput = linkForm.querySelector("input") as HTMLInputElement;
  let linkRange: Range | null = null;

  const HEIGHT_PROP: Record<string, string> = {
    spacer: "height",
    map: "height",
  };
  const HEIGHT_STYLE = new Set([
    "section",
    "columns",
    "column",
    "hero",
    "cta",
    "text",
    "cards",
    "features",
  ]);
  const NAMES: Record<string, string> =
    (win as unknown as { __WS_NAMES__?: Record<string, string> })
      .__WS_NAMES__ ?? {};

  /** Élément réellement stylé : la section interne pour une section. */
  const styled = (el: HTMLElement) =>
    typeOf(el) === "section"
      ? ((el.querySelector(":scope>.ws-section") as HTMLElement | null) ?? el)
      : el;

  const place = (
    node: HTMLElement,
    rect:
      | DOMRect
      | { left: number; top: number; width: number; height: number },
  ) => {
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
  };

  function columnsOf(el: HTMLElement | null): HTMLElement | null {
    if (!el) return null;
    if (typeOf(el) === "columns") return el;
    if (typeOf(el) === "column") return blockOf(el.parentElement);
    return null;
  }

  /* Espacements réels (thème compris) : affichés en indication dans le panneau. */
  let lastMetrics = "";
  function sendMetrics(el: HTMLElement | null) {
    let data: Record<string, unknown> = { id: selected };
    if (el) {
      const cs = getComputedStyle(styled(el));
      const box = (prop: "padding" | "margin") =>
        Object.fromEntries(
          (["top", "right", "bottom", "left"] as const).map((side) => [
            side,
            Math.round(
              Number.parseFloat(cs.getPropertyValue(`${prop}-${side}`)) || 0,
            ),
          ]),
        );
      data = { ...data, padding: box("padding"), margin: box("margin") };
    }
    const key = JSON.stringify(data);
    if (key === lastMetrics) return;
    lastMetrics = key;
    post({ type: "metrics", ...data });
  }

  function layout() {
    doc.querySelectorAll("[data-ws-selected]").forEach((n) => {
      n.removeAttribute("data-ws-selected");
    });
    const el = byId(selected);
    const hide = !el || editing !== null;
    toolbar.hidden = !el;
    handleE.hidden = hide || typeOf(el) === "column";
    handleS.hidden =
      hide || !(HEIGHT_STYLE.has(typeOf(el)) || HEIGHT_PROP[typeOf(el)]);
    gutters.innerHTML = "";
    sendMetrics(el);
    if (!el) return;
    el.setAttribute("data-ws-selected", "");
    const r = el.getBoundingClientRect();
    (toolbar.querySelector(".wse-name") as HTMLElement).textContent =
      NAMES[typeOf(el)] ?? typeOf(el);
    grip.hidden = typeOf(el) === "column";
    toolbar.style.left = `${Math.max(0, r.left)}px`;
    toolbar.style.top = `${Math.max(0, r.top - 30)}px`;
    handleE.style.left = `${r.right - 5}px`;
    handleE.style.top = `${r.top + r.height / 2 - 14}px`;
    handleS.style.left = `${r.left + r.width / 2 - 14}px`;
    handleS.style.top = `${r.bottom - 5}px`;
    const cols = columnsOf(el);
    const grid = cols?.querySelector(
      ":scope>.ws-columns",
    ) as HTMLElement | null;
    if (cols && grid && !editing) {
      const kids = Array.from(grid.children) as HTMLElement[];
      const style = getComputedStyle(grid);
      const sideBySide =
        style.display === "grid" &&
        style.gridTemplateColumns.split(" ").length > 1;
      if (sideBySide) {
        for (let i = 0; i < kids.length - 1; i++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[i + 1].getBoundingClientRect();
          const g = doc.createElement("div");
          g.className = "wse-gutter";
          g.title = "Glisser pour répartir les colonnes";
          g.dataset.index = String(i);
          g.dataset.columns = cols.getAttribute("data-ws-block") ?? "";
          place(g, {
            left:
              (Math.min(a.right, b.left) + Math.max(a.right, b.left)) / 2 - 4,
            top: Math.min(a.top, b.top),
            width: 8,
            height: Math.max(a.height, b.height),
          });
          gutters.appendChild(g);
        }
      }
    }
  }

  function select(id: string | null, notify = true, scroll = false) {
    if (editing) stopEditing(true);
    selected = id;
    layout();
    if (scroll)
      byId(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (notify) post({ type: "select", id });
  }

  /* Édition directe des textes */
  function startEditing(node: HTMLElement) {
    const el = blockOf(node);
    if (!el) return;
    if (selected !== el.getAttribute("data-ws-block"))
      select(el.getAttribute("data-ws-block"));
    editing = node;
    editingOriginal = node.innerHTML;
    const rich = node.hasAttribute("data-ws-rich");
    node.setAttribute("contenteditable", rich ? "true" : "plaintext-only");
    node.focus();
    const range = doc.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    layout();
  }

  function stopEditing(commit: boolean) {
    const node = editing;
    if (!node) return;
    editing = null;
    bubble.hidden = true;
    node.removeAttribute("contenteditable");
    if (!commit) {
      node.innerHTML = editingOriginal;
    } else if (node.innerHTML !== editingOriginal) {
      const rich = node.hasAttribute("data-ws-rich");
      const value = rich
        ? node.innerHTML
        : (node.innerText ?? "").replace(/\n+$/, "");
      post({
        type: "prop",
        id: blockOf(node)?.getAttribute("data-ws-block"),
        path: node.getAttribute("data-ws-edit"),
        value,
      });
    }
    layout();
  }

  function showBubble() {
    if (linkRange) return;
    if (!editing?.hasAttribute("data-ws-rich")) return;
    const sel = win.getSelection();
    if (!sel || sel.isCollapsed || !editing.contains(sel.anchorNode)) {
      bubble.hidden = true;
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    bubble.hidden = false;
    bubble.style.left = `${Math.max(4, r.left + r.width / 2 - bubble.offsetWidth / 2)}px`;
    bubble.style.top = `${Math.max(4, r.top - bubble.offsetHeight - 8)}px`;
  }

  bubble.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest("button");
    const cmd = btn?.getAttribute("data-cmd");
    if (!cmd) return;
    if (cmd === "createLink") {
      const sel = win.getSelection();
      if (!sel?.rangeCount) return;
      linkRange = sel.getRangeAt(0).cloneRange();
      const current = (
        sel.anchorNode?.parentElement?.closest("a") as HTMLAnchorElement | null
      )?.getAttribute("href");
      linkInput.value = current ?? "";
      linkForm.hidden = false;
      linkInput.focus();
      return;
    } else {
      doc.execCommand(cmd);
    }
    showBubble();
  });
  /* Lien : saisie dans la bulle, sans boîte de dialogue */
  const closeLink = (apply: boolean) => {
    const range = linkRange;
    linkRange = null;
    linkForm.hidden = true;
    if (!editing || !range) return;
    editing.focus();
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const url = linkInput.value.trim();
    if (apply) {
      if (url)
        doc.execCommand(
          "createLink",
          false,
          /^(https?:|mailto:|tel:|\/|#)/.test(url) ? url : `https://${url}`,
        );
      else doc.execCommand("unlink");
    }
    showBubble();
  };
  linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    closeLink(true);
  });
  linkInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      closeLink(false);
    }
  });
  linkInput.addEventListener("blur", (e) => {
    if (!linkRange || bubble.contains(e.relatedTarget as Node)) return;
    linkRange = null;
    linkForm.hidden = true;
    if (editing) stopEditing(true);
  });
  bubble.addEventListener("mousedown", (e) => {
    if (e.target !== linkInput) e.preventDefault();
  });
  doc.addEventListener("selectionchange", showBubble);

  /* Clics : sélection, puis édition au second clic ou au double-clic */
  doc.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element;
      if (ui.contains(target)) return;
      if (editing && editing.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = blockOf(target);
      const editable = target.closest("[data-ws-edit]") as HTMLElement | null;
      if (
        editable &&
        el &&
        el.getAttribute("data-ws-block") === selected &&
        blockOf(editable) === el
      ) {
        startEditing(editable);
        return;
      }
      if (editing) stopEditing(true);
      select(el?.getAttribute("data-ws-block") ?? null);
    },
    true,
  );
  doc.addEventListener("dblclick", (e) => {
    const editable = (e.target as Element).closest(
      "[data-ws-edit]",
    ) as HTMLElement | null;
    if (editable && editable !== editing) startEditing(editable);
  });
  doc.addEventListener("focusout", (e) => {
    if (
      editing &&
      e.target === editing &&
      !bubble.contains(e.relatedTarget as Node)
    )
      stopEditing(true);
  });
  doc.addEventListener("submit", (e) => e.preventDefault(), true);

  toolbar.addEventListener("click", (e) => {
    const act = (e.target as Element)
      .closest("button")
      ?.getAttribute("data-act");
    if (!act || !selected) return;
    if (act === "parent") {
      const parentBlock = blockOf(byId(selected)?.parentElement ?? null);
      select(parentBlock?.getAttribute("data-ws-block") ?? null);
      return;
    }
    post({ type: "action", action: act, id: selected });
  });

  /* Clavier */
  doc.addEventListener("keydown", (e) => {
    if (editing) {
      if (e.key === "Escape") {
        e.preventDefault();
        stopEditing(false);
      } else if (
        e.key === "Enter" &&
        !editing.hasAttribute("data-ws-rich") &&
        !e.shiftKey
      ) {
        e.preventDefault();
        stopEditing(true);
      }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (
      mod &&
      (e.key.toLowerCase() === "z" ||
        e.key.toLowerCase() === "y" ||
        e.key.toLowerCase() === "s")
    ) {
      e.preventDefault();
      post({ type: "key", key: e.key.toLowerCase(), shift: e.shiftKey });
      return;
    }
    if (!selected) return;
    const all = Array.from(doc.querySelectorAll("[data-ws-block]")).map((n) =>
      n.getAttribute("data-ws-block"),
    );
    const index = all.indexOf(selected);
    if (e.key === "Delete" || e.key === "Backspace")
      post({ type: "action", action: "delete", id: selected });
    else if (mod && e.key.toLowerCase() === "d")
      post({ type: "action", action: "duplicate", id: selected });
    else if (e.altKey && e.key === "ArrowUp")
      post({ type: "action", action: "up", id: selected });
    else if (e.altKey && e.key === "ArrowDown")
      post({ type: "action", action: "down", id: selected });
    else if (e.key === "ArrowUp" && index > 0)
      select(all[index - 1], true, true);
    else if (e.key === "ArrowDown" && index < all.length - 1)
      select(all[index + 1], true, true);
    else if (e.key === "Enter") {
      const editable = byId(selected)?.querySelector(
        "[data-ws-edit]",
      ) as HTMLElement | null;
      if (editable) startEditing(editable);
    } else if (e.key === "Escape") {
      const parentBlock = blockOf(byId(selected)?.parentElement ?? null);
      select(parentBlock?.getAttribute("data-ws-block") ?? null);
    } else return;
    e.preventDefault();
  });

  /* Glisser-déposer : déplacement depuis la poignée, ajout depuis la palette */
  grip.addEventListener("dragstart", (e) => {
    if (!selected) return;
    dragging = { kind: "move", id: selected };
    e.dataTransfer?.setData("text/x-ws-move", selected);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    const el = byId(selected);
    if (el) e.dataTransfer?.setDragImage(el, 20, 20);
  });

  type Target = {
    id?: string;
    zone?: string;
    position: "before" | "after" | "inside";
  };
  let current: Target | null = null;

  function targetAt(e: DragEvent): Target | null {
    const el = blockOf(e.target);
    const movingId = dragging?.kind === "move" ? dragging.id : null;
    if (el) {
      if (movingId) {
        const moving = byId(movingId);
        if (moving && (moving === el || moving.contains(el))) return null;
      }
      const r = el.getBoundingClientRect();
      const y = e.clientY - r.top;
      const edge = Math.min(14, r.height / 4);
      const id = el.getAttribute("data-ws-block") ?? undefined;
      if (el.hasAttribute("data-ws-container")) {
        if (typeOf(el) !== "column" && y < edge)
          return { id, position: "before" };
        if (typeOf(el) !== "column" && y > r.height - edge)
          return { id, position: "after" };
        return { id, position: "inside" };
      }
      return { id, position: y < r.height / 2 ? "before" : "after" };
    }
    const zone = (e.target as Element | null)?.closest?.("[data-ws-zone]");
    return zone
      ? {
          zone: zone.getAttribute("data-ws-zone") ?? undefined,
          position: "inside",
        }
      : null;
  }

  function showDrop(t: Target | null) {
    current = t;
    if (!t) {
      drop.hidden = true;
      return;
    }
    const el = t.id
      ? byId(t.id)
      : (doc.querySelector(`[data-ws-zone="${t.zone}"]`) as HTMLElement | null);
    if (!el) {
      drop.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    drop.hidden = false;
    drop.className = `wse-drop wse-drop--${t.position}`;
    if (t.position === "inside") place(drop, r);
    else
      place(drop, {
        left: r.left,
        top: t.position === "before" ? r.top - 2 : r.bottom - 2,
        width: r.width,
        height: 4,
      });
  }

  doc.addEventListener("dragover", (e) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (
      !dragging &&
      !types.includes("text/x-ws-insert") &&
      !types.includes("text/x-ws-move")
    )
      return;
    if (!dragging && types.includes("text/x-ws-insert"))
      dragging = { kind: "insert", type: "" };
    const t = targetAt(e);
    showDrop(t);
    if (t) {
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = dragging?.kind === "move" ? "move" : "copy";
    }
  });
  doc.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget) showDrop(null);
  });
  doc.addEventListener("drop", (e) => {
    e.preventDefault();
    const t = current;
    showDrop(null);
    const insertType = e.dataTransfer?.getData("text/x-ws-insert");
    if (t && insertType)
      post({ type: "insert", blockType: insertType, target: t });
    else if (t && dragging?.kind === "move")
      post({ type: "move", id: dragging.id, target: t });
    dragging = null;
  });
  doc.addEventListener("dragend", () => {
    dragging = null;
    showDrop(null);
  });

  /* Redimensionnement : largeur, hauteur, répartition des colonnes */
  function drag(
    e: PointerEvent,
    onMove: (dx: number, dy: number) => void,
    onEnd: () => void,
  ) {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      onMove(ev.clientX - x0, ev.clientY - y0);
      layout();
    };
    const up = () => {
      resizing = false;
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", up);
      onEnd();
    };
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", up);
  }

  handleE.addEventListener("pointerdown", (e) => {
    const el = byId(selected);
    if (!el) return;
    const target = styled(el);
    const r = target.getBoundingClientRect();
    const parentRect = (el.parentElement ?? doc.body).getBoundingClientRect();
    const centered =
      Math.abs(r.left - parentRect.left - (parentRect.right - r.right)) < 4 &&
      r.width < parentRect.width - 4;
    let width = r.width;
    drag(
      e,
      (dx) => {
        width = Math.max(
          40,
          Math.min(parentRect.width, r.width + dx * (centered ? 2 : 1)),
        );
        target.style.maxWidth = `${width}px`;
        target.style.width = "100%";
        if (centered || typeOf(el) === "section")
          target.style.marginInline = "auto";
      },
      () =>
        post({
          type: "style",
          id: selected,
          values: {
            maxWidth:
              width >= parentRect.width - 2
                ? undefined
                : Math.round(width / 10) * 10,
          },
        }),
    );
  });
  handleE.addEventListener("dblclick", () =>
    post({ type: "style", id: selected, values: { maxWidth: undefined } }),
  );

  handleS.addEventListener("pointerdown", (e) => {
    const el = byId(selected);
    if (!el) return;
    const prop = HEIGHT_PROP[typeOf(el)];
    const target = prop
      ? ((el.querySelector(".ws-spacer, iframe") as HTMLElement | null) ?? el)
      : styled(el);
    const h0 = target.getBoundingClientRect().height;
    let height = h0;
    drag(
      e,
      (_dx, dy) => {
        height = Math.max(prop ? 8 : 0, h0 + dy);
        if (prop) target.style.height = `${height}px`;
        else target.style.minHeight = `${height}px`;
      },
      () => {
        const value = Math.round(height / 10) * 10;
        if (prop) post({ type: "prop", id: selected, path: prop, value });
        else
          post({
            type: "style",
            id: selected,
            values: { minHeight: value || undefined },
          });
      },
    );
  });
  handleS.addEventListener("dblclick", () => {
    const el = byId(selected);
    if (el && !HEIGHT_PROP[typeOf(el)])
      post({ type: "style", id: selected, values: { minHeight: undefined } });
  });

  gutters.addEventListener("pointerdown", (e) => {
    const g = (e.target as Element).closest(
      ".wse-gutter",
    ) as HTMLElement | null;
    if (!g) return;
    const cols = byId(g.dataset.columns ?? null);
    const grid = cols?.querySelector(
      ":scope>.ws-columns",
    ) as HTMLElement | null;
    if (!cols || !grid) return;
    const i = Number(g.dataset.index);
    const widths = Array.from(grid.children).map(
      (c) => c.getBoundingClientRect().width,
    );
    const start = [...widths];
    drag(
      e,
      (dx) => {
        const total = start[i] + start[i + 1];
        widths[i] = Math.max(40, Math.min(total - 40, start[i] + dx));
        widths[i + 1] = total - widths[i];
        grid.style.gridTemplateColumns = widths.map((w) => `${w}fr`).join(" ");
      },
      () => {
        const sum = widths.reduce((a, b) => a + b, 0);
        const ratio = widths
          .map((w) => Math.round((w / sum) * widths.length * 20) / 20)
          .join("-");
        post({
          type: "prop",
          id: g.dataset.columns,
          path: "ratio",
          value: ratio,
        });
      },
    );
  });

  /* Messages de l'éditeur */
  win.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "ws-editor") return;
    if (d.type === "select") select(d.id ?? null, false, !!d.scroll);
  });
  win.addEventListener("scroll", () => layout(), {
    passive: true,
  });
  win.addEventListener("resize", () => layout());
  new ResizeObserver(() => !resizing && layout()).observe(doc.body);
  post({ type: "ready" });
}

export const EDITOR_FRAME_CSS = `
[data-ws-block]{outline:1px dashed transparent;outline-offset:-1px}
[data-ws-block]:hover{outline-color:rgb(56 168 237/.55)}
[data-ws-selected]{outline:2px solid #38a8ed!important;outline-offset:-2px}
[data-ws-edit]{cursor:text}
[data-ws-edit]:empty::before{content:"…";opacity:.35}
[data-ws-edit][contenteditable]{outline:2px solid #f0b264;outline-offset:2px;cursor:text}
[data-ws-zone]{min-height:48px}
[data-ws-zone]:empty{outline:1px dashed rgb(81 99 122/.4);outline-offset:-4px}
.ws-placeholder{padding:2rem;border:2px dashed rgb(56 168 237/.5);border-radius:8px;text-align:center;color:#51637a;font:600 .9rem system-ui}
.ws-field-slot{display:flex;align-items:baseline;gap:.6rem;padding:.75rem 1rem;border:2px dashed rgb(56 168 237/.55);border-radius:6px;background:rgb(56 168 237/.06);font:500 .95rem system-ui}.ws-field-slot span{color:#51637a;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
.ws-dropzone{min-height:3rem;border:1px dashed rgb(81 99 122/.35);border-radius:6px}
/* Couche fixe et rognée : les cadres ne débordent jamais du document (sinon barres de défilement et tremblements). */
.wse{position:fixed;inset:0;z-index:2147483000;overflow:hidden;pointer-events:none;font:600 12px/1 system-ui,sans-serif;color:#101c2c}
.wse-toolbar,.wse-handle,.wse-gutter,.wse-bubble{pointer-events:auto}
.wse [hidden]{display:none!important}
.wse-toolbar{position:absolute;z-index:2147483000;display:flex;align-items:center;gap:1px;height:28px;padding:2px;border-radius:5px 5px 0 0;background:#38a8ed;color:#fff;box-shadow:0 4px 12px rgb(0 0 0/.2)}
.wse-toolbar button,.wse-grip{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:24px;height:24px;padding:0 6px;border:0;border-radius:3px;background:none;color:inherit;font:inherit;cursor:pointer}
.wse-grip{cursor:grab;white-space:nowrap}.wse-grip:active{cursor:grabbing}
.wse-toolbar button:hover,.wse-grip:hover{background:rgb(255 255 255/.22)}
.wse-handle{position:absolute;z-index:2147483001;width:28px;height:28px;border-radius:50%;background:#fff;border:2px solid #38a8ed;box-shadow:0 2px 6px rgb(0 0 0/.25);touch-action:none}
.wse-handle--e{width:10px;cursor:ew-resize;border-radius:5px}
.wse-handle--s{height:10px;cursor:ns-resize;border-radius:5px}
.wse-gutter{position:absolute;z-index:2147483001;cursor:col-resize;touch-action:none;background:repeating-linear-gradient(#38a8ed 0 6px,transparent 6px 10px);opacity:.6;border-radius:4px}
.wse-gutter:hover{opacity:1;background:#38a8ed}
.wse-drop{position:absolute;z-index:2147483002;pointer-events:none;background:#38a8ed;border-radius:2px}
.wse-drop--inside{background:rgb(56 168 237/.12);outline:2px dashed #38a8ed;outline-offset:-2px}
.wse-bubble{position:absolute;z-index:2147483003;display:flex;gap:2px;padding:3px;border-radius:6px;background:#152438;box-shadow:0 8px 24px rgb(0 0 0/.3)}
.wse-bubble button{min-width:26px;height:26px;border:0;border-radius:4px;background:none;color:#fff;font:inherit;font-size:13px;cursor:pointer}
.wse-bubble button:hover{background:rgb(255 255 255/.15)}
.wse-link{display:flex}.wse-link[hidden]{display:none}.wse-link input{width:220px;height:26px;border:0;border-radius:4px;padding:0 8px;font:inherit;font-size:13px}`;

export const editorFrameScript = (names: Record<string, string>) =>
  `window.__WS_NAMES__=${JSON.stringify(names).replace(/</g, "\\u003c")};(${editorFrame.toString()})();`;
