import type { Editor, Node as TiptapNode } from "@tiptap/core";
import type { DOMOutputSpec, Node as PmNode } from "@tiptap/pm/model";

export const URL_RE = /^https?:\/\/[^\s<>"]+$/i;
export const YOUTUBE_RE =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com\/(watch|shorts|embed|live)|youtu\.be\/|youtube-nocookie\.com\/embed)\S*$/i;

export type CardDisplay = "inline" | "card";
export type CardAttrs = {
  href: string;
  title: string;
  description: string;
  image: string;
  site: string;
  display: CardDisplay;
  loading: boolean;
};

const host = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
};

/** Rendu HTML d'un lien enrichi : titre seul (« inline ») ou carte avec image et description. */
export function cardSpec(a: CardAttrs): DOMOutputSpec {
  const card = a.display === "card";
  const site = a.site || host(a.href);
  const body: DOMOutputSpec[] = [
    [
      "span",
      { class: "ws-link-card__title" },
      a.loading ? "Chargement…" : a.title || a.href,
    ],
  ];
  if (card && a.description)
    body.push(["span", { class: "ws-link-card__desc" }, a.description]);
  body.push(["span", { class: "ws-link-card__site" }, site]);
  const children: DOMOutputSpec[] = [];
  if (card && a.image)
    children.push([
      "img",
      { class: "ws-link-card__img", src: a.image, alt: "", loading: "lazy" },
    ]);
  children.push(["span", { class: "ws-link-card__body" }, ...body]);
  return [
    "a",
    {
      class: `ws-link-card ws-link-card--${card ? "card" : "inline"}`,
      href: a.href,
      target: "_blank",
      rel: "noopener noreferrer",
      "data-link-card": "",
      "data-display": a.display,
      "data-title": a.title,
      "data-description": a.description,
      "data-image": a.image,
      "data-site": a.site,
    },
    ...children,
  ];
}

const DISPLAYS: { value: string; label: string; title: string }[] = [
  { value: "link", label: "URL", title: "Lien simple dans le texte" },
  { value: "inline", label: "Titre", title: "Titre du site" },
  { value: "card", label: "Carte", title: "Aperçu avec image et description" },
  { value: "video", label: "Vidéo", title: "Lecteur vidéo intégré" },
];

/** Remplace le nœud par un autre affichage (lien texte ou vidéo). */
function convert(editor: Editor, pos: number, node: PmNode, to: string) {
  const range = { from: pos, to: pos + node.nodeSize };
  const a = node.attrs as CardAttrs;
  if (to === "link")
    return editor
      .chain()
      .focus()
      .insertContentAt(range, {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: a.title || a.href,
            marks: [{ type: "link", attrs: { href: a.href } }],
          },
        ],
      })
      .run();
  if (to === "video")
    return editor
      .chain()
      .focus()
      .insertContentAt(range, { type: "youtube", attrs: { src: a.href } })
      .run();
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, { ...a, display: to }),
  );
  return true;
}

/** Nœud « lien enrichi » ; la fabrique reçoit Node pour garder Tiptap en chargement différé. */
export function createLinkCard(
  Node: typeof TiptapNode,
  renderSpec: (spec: DOMOutputSpec) => HTMLElement,
) {
  return Node.create({
    name: "linkCard",
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      const data = (key: string) => ({
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute(`data-${key}`) ?? "",
        renderHTML: () => ({}),
      });
      return {
        href: {
          default: "",
          parseHTML: (el: HTMLElement) => el.getAttribute("href") ?? "",
          renderHTML: () => ({}),
        },
        title: data("title"),
        description: data("description"),
        image: data("image"),
        site: data("site"),
        display: {
          default: "card",
          parseHTML: (el: HTMLElement) =>
            el.getAttribute("data-display") === "inline" ? "inline" : "card",
          renderHTML: () => ({}),
        },
        loading: { default: false, rendered: false },
      };
    },
    parseHTML() {
      return [{ tag: "a[data-link-card]" }];
    },
    renderHTML({ node }) {
      return cardSpec(node.attrs as CardAttrs);
    },
    addNodeView() {
      return ({ node: initial, editor, getPos }) => {
        let node = initial;
        const dom = document.createElement("div");
        dom.className = "ui-linkcard";
        dom.contentEditable = "false";
        const view = document.createElement("div");
        const bar = document.createElement("div");
        bar.className = "ui-linkcard__bar";
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "Affichage du lien");
        dom.append(view, bar);
        const render = () => {
          const a = node.attrs as CardAttrs;
          view.replaceChildren(renderSpec(cardSpec(a)));
          bar.replaceChildren(
            ...DISPLAYS.filter(
              (d) => d.value !== "video" || YOUTUBE_RE.test(a.href),
            ).map((d) => {
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = d.label;
              button.title = d.title;
              button.setAttribute(
                "aria-pressed",
                String(a.display === d.value),
              );
              button.addEventListener("mousedown", (e) => e.preventDefault());
              button.addEventListener("click", () => {
                const pos = getPos();
                if (typeof pos === "number")
                  convert(editor, pos, node, d.value);
              });
              return button;
            }),
          );
        };
        dom.addEventListener("click", (e) => {
          if ((e.target as Element).closest("a")) e.preventDefault();
        });
        render();
        return {
          dom,
          update: (next) => {
            if (next.type !== node.type) return false;
            node = next;
            render();
            return true;
          },
          selectNode: () => dom.classList.add("is-selected"),
          deselectNode: () => dom.classList.remove("is-selected"),
          stopEvent: (e) => bar.contains(e.target as Node),
          ignoreMutation: () => true,
        };
      };
    },
  });
}
