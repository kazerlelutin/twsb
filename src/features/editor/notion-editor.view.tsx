import type { Editor, Range } from "@tiptap/core";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { api } from "../admin/client";
import { MediaPicker, uploadFiles } from "../admin/media-library.view";
import { notifyError } from "../admin/toast";
import { mediaUrl } from "../render/blocks.render";
import type { MediaInfo } from "../site/site.type";
import { promptDialog } from "../ui/dialog.view";
import { createLinkCard, URL_RE, YOUTUBE_RE } from "./link-card";
import { filterSlash, SLASH_ITEMS, type SlashItem } from "./slash-items";

/** Variante d'image adaptée au texte (≤ 1280 px). */
const textImage = (media: MediaInfo) => {
  const large =
    [...media.variants]
      .sort((a, b) => b.width - a.width)
      .find((v) => v.width <= 1280) ?? media.variants[0];
  return { src: mediaUrl(media, large?.file), alt: media.alt };
};

const imageFiles = (list: FileList | null | undefined) =>
  Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

type SlashState = {
  items: SlashItem[];
  index: number;
  rect: DOMRect | null;
  range: Range;
};

/** Éditeur de texte façon Notion : « / » pour insérer, bulle de mise en forme. */
export function NotionEditor(props: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  compact?: boolean;
  label?: string;
  autofocus?: boolean;
  /** « field » : champ d'un formulaire, sans cadre ; « plain » : paragraphes seuls. */
  variant?: "page" | "field" | "plain";
}) {
  const plain = () => props.variant === "plain";
  let host!: HTMLDivElement;
  let bubble!: HTMLDivElement;
  let disposed = false;
  const [editor, setEditor] = createSignal<Editor>();
  const [active, setActive] = createSignal<Record<string, boolean>>({});
  const [slash, setSlash] = createSignal<SlashState | null>(null);
  const [picker, setPicker] = createSignal<Range | null>(null);
  const [linking, setLinking] = createSignal(false);

  /** Lien collé seul : vidéo YouTube intégrée, sinon carte d'aperçu complétée par le serveur. */
  const embedUrl = async (url: string) => {
    const instance = editor();
    if (!instance) return;
    if (YOUTUBE_RE.test(url)) {
      instance.chain().focus().setYoutubeVideo({ src: url }).run();
      return;
    }
    instance
      .chain()
      .focus()
      .insertContent({
        type: "linkCard",
        attrs: { href: url, loading: true, display: "card" },
      })
      .run();
    let preview: Record<string, string> = {};
    try {
      preview = (
        await api<{ preview: Record<string, string> }>(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
        )
      ).preview;
    } catch {
      // Sans aperçu, la carte garde l'adresse.
    }
    const { state, view } = instance;
    state.doc.descendants((node, pos) => {
      if (
        node.type.name === "linkCard" &&
        node.attrs.loading &&
        node.attrs.href === url
      ) {
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            title: preview.title ?? "",
            description: preview.description ?? "",
            image: preview.image ?? "",
            site: preview.site ?? "",
            loading: false,
          }),
        );
        return false;
      }
      return true;
    });
  };

  const uploadImages = async (files: File[], pos?: number) => {
    const instance = editor();
    if (!instance || !files.length) return;
    try {
      const items = await uploadFiles(files);
      const content = items.map((m) => ({
        type: "image",
        attrs: textImage(m),
      }));
      if (pos === undefined)
        instance.chain().focus().insertContent(content).run();
      else instance.chain().focus().insertContentAt(pos, content).run();
    } catch (e) {
      notifyError(e);
    }
  };

  const run = async (item: SlashItem, range: Range) => {
    const instance = editor();
    if (!instance) return;
    if (item.id === "image") {
      instance.chain().focus().deleteRange(range).run();
      setPicker(range);
      return;
    }
    if (item.id === "video" || item.id === "bookmark") {
      instance.chain().focus().deleteRange(range).run();
      const url = await promptDialog({
        title: item.id === "video" ? "Vidéo YouTube" : "Lien avec aperçu",
        label: "Adresse",
        placeholder: "https://",
        confirmLabel: "Insérer",
      });
      const clean = url?.trim();
      if (!clean) return;
      const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      if (item.id === "video" && !YOUTUBE_RE.test(full)) {
        notifyError(new Error("Ce n'est pas une adresse YouTube."));
        return;
      }
      embedUrl(full);
      return;
    }
    item.run(instance.chain().focus().deleteRange(range));
  };

  onMount(async () => {
    const [
      { Editor, Extension },
      { default: StarterKit },
      { Placeholder },
      { default: Image },
      { TaskList },
      { TaskItem },
      { default: Suggestion },
      { BubbleMenu },
      { default: Youtube },
      { DOMSerializer },
    ] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-placeholder"),
      import("@tiptap/extension-image"),
      import("@tiptap/extension-task-list"),
      import("@tiptap/extension-task-item"),
      import("@tiptap/suggestion"),
      import("@tiptap/extension-bubble-menu"),
      import("@tiptap/extension-youtube"),
      import("@tiptap/pm/model"),
    ]);
    if (disposed) return;
    const { Node } = await import("@tiptap/core");
    const LinkCard = createLinkCard(Node, (spec) => {
      return DOMSerializer.renderSpec(document, spec).dom as HTMLElement;
    });

    const SlashCommand = Extension.create({
      name: "slashCommand",
      addProseMirrorPlugins() {
        return [
          Suggestion<SlashItem>({
            editor: this.editor,
            char: "/",
            startOfLine: false,
            allowSpaces: false,
            items: ({ query }) => filterSlash(query, props.compact),
            command: ({ range, props: item }) => run(item, range),
            render: () => ({
              onStart: (p) =>
                setSlash({
                  items: p.items,
                  index: 0,
                  rect: p.clientRect?.() ?? null,
                  range: p.range,
                }),
              onUpdate: (p) =>
                setSlash({
                  items: p.items,
                  index: 0,
                  rect: p.clientRect?.() ?? null,
                  range: p.range,
                }),
              onKeyDown: ({ event }) => {
                const state = slash();
                if (!state) return false;
                if (event.key === "Escape") {
                  setSlash(null);
                  return true;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  const count = state.items.length || 1;
                  setSlash({
                    ...state,
                    index: (state.index + delta + count) % count,
                  });
                  return true;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  const item = state.items[state.index];
                  if (item) run(item, state.range);
                  setSlash(null);
                  return true;
                }
                return false;
              },
              onExit: () => setSlash(null),
            }),
          }),
        ];
      },
    });

    const instance = new Editor({
      element: host,
      injectCSS: false,
      content: props.value,
      autofocus: props.autofocus ? "end" : false,
      extensions: [
        StarterKit.configure({
          ...(plain()
            ? {
                heading: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                blockquote: false,
                codeBlock: false,
                horizontalRule: false,
                code: false,
              }
            : {
                heading: {
                  levels: props.compact ? [2, 3] : ([1, 2, 3] as (1 | 2 | 3)[]),
                },
              }),
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
          },
        }),
        Placeholder.configure({
          placeholder:
            props.placeholder ??
            (plain() ? "Vide" : "Tapez « / » pour insérer un bloc"),
        }),
        ...(plain()
          ? []
          : [
              Image.configure({ inline: false }),
              Youtube.configure({
                nocookie: true,
                addPasteHandler: false,
                width: 640,
                height: 360,
                HTMLAttributes: { title: "Vidéo YouTube", loading: "lazy" },
              }),
              LinkCard,
              TaskList,
              TaskItem.configure({ nested: true }),
              SlashCommand,
            ]),
        BubbleMenu.configure({
          element: bubble,
          shouldShow: ({ editor: e, from, to }) =>
            from !== to && !e.isActive("image"),
        }),
      ],
      editorProps: {
        handlePaste: (view, event) => {
          const images = plain() ? [] : imageFiles(event.clipboardData?.files);
          if (images.length) {
            uploadImages(images);
            return true;
          }
          const text = event.clipboardData?.getData("text/plain").trim() ?? "";
          if (!URL_RE.test(text)) return false;
          const { selection } = view.state;
          if (!selection.empty) {
            editor()?.chain().focus().setLink({ href: text }).run();
            return true;
          }
          const parent = selection.$from.parent;
          // Seul sur sa ligne, un lien devient un aperçu ou une vidéo.
          if (
            plain() ||
            parent.type.name !== "paragraph" ||
            parent.textContent.trim()
          )
            return false;
          embedUrl(text);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved || plain()) return false;
          const images = imageFiles(event.dataTransfer?.files);
          if (!images.length) return false;
          event.preventDefault();
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos;
          uploadImages(images, pos);
          return true;
        },
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": props.label ?? "Contenu",
        },
      },
      onUpdate: ({ editor: e }) => props.onChange(e.isEmpty ? "" : e.getHTML()),
      onTransaction: ({ editor: e }) =>
        setActive({
          bold: e.isActive("bold"),
          italic: e.isActive("italic"),
          strike: e.isActive("strike"),
          code: e.isActive("code"),
          link: e.isActive("link"),
          h2: e.isActive("heading", { level: 2 }),
        }),
    });
    setEditor(instance);
  });

  onCleanup(() => {
    disposed = true;
    editor()?.destroy();
  });

  createEffect(() => {
    const value = props.value;
    const instance = editor();
    untrack(() => {
      if (instance && !instance.isFocused && instance.getHTML() !== value)
        instance.commands.setContent(value || "", { emitUpdate: false });
    });
  });

  let linkInput: HTMLInputElement | undefined;
  const link = () => {
    const instance = editor();
    if (!instance) return;
    setLinking(true);
    if (linkInput) {
      linkInput.value = instance.getAttributes("link").href ?? "";
      queueMicrotask(() => linkInput?.focus());
    }
  };
  const applyLink = (value: string | null) => {
    const instance = editor();
    setLinking(false);
    if (!instance) return;
    const url = value?.trim();
    if (value === null) instance.chain().focus().run();
    else if (!url)
      instance.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      instance
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href: /^(https?:|mailto:|tel:|\/|#)/.test(url)
            ? url
            : `https://${url}`,
        })
        .run();
  };

  const allMarks = [
    {
      key: "bold",
      label: "G",
      name: "Gras",
      run: (e: Editor) => e.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "I",
      name: "Italique",
      run: (e: Editor) => e.chain().focus().toggleItalic().run(),
    },
    {
      key: "strike",
      label: "S",
      name: "Barré",
      run: (e: Editor) => e.chain().focus().toggleStrike().run(),
    },
    {
      key: "code",
      label: "</>",
      name: "Code",
      run: (e: Editor) => e.chain().focus().toggleCode().run(),
    },
    {
      key: "h2",
      label: "H",
      name: "Titre",
      run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
  ];
  const marks = () =>
    plain()
      ? allMarks.filter((m) => m.key !== "code" && m.key !== "h2")
      : allMarks;

  return (
    <div
      class="ui-prose"
      classList={{
        "ui-prose--compact": props.compact,
        "ui-prose--field":
          props.variant === "field" || props.variant === "plain",
      }}
    >
      <div
        ref={bubble}
        class="ui-bubble"
        role="toolbar"
        aria-label="Mise en forme"
      >
        <For each={marks()}>
          {(m) => (
            <button
              type="button"
              aria-label={m.name}
              title={m.name}
              aria-pressed={!!active()[m.key]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor() && m.run(editor() as Editor)}
            >
              {m.label}
            </button>
          )}
        </For>
        <button
          type="button"
          aria-label="Lien"
          title="Lien"
          aria-pressed={!!active().link}
          onMouseDown={(e) => e.preventDefault()}
          onClick={link}
        >
          ⛓
        </button>
        <form
          class="ui-bubble__link"
          hidden={!linking()}
          onSubmit={(e) => {
            e.preventDefault();
            applyLink(linkInput?.value ?? "");
          }}
        >
          <input
            ref={linkInput}
            aria-label="Adresse du lien"
            placeholder="https://… puis Entrée"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                applyLink(null);
              }
            }}
            onBlur={(e) => {
              if (!bubble.contains(e.relatedTarget as Node)) setLinking(false);
            }}
          />
        </form>
      </div>
      <div ref={host} />
      <Show when={slash()}>
        {(state) => (
          <Portal>
            <div
              class="ui-slash"
              role="listbox"
              aria-label="Insérer un bloc"
              style={{
                top: `${Math.min((state().rect?.bottom ?? 0) + 6, window.innerHeight - 330)}px`,
                left: `${Math.min(state().rect?.left ?? 0, window.innerWidth - 270)}px`,
              }}
            >
              <Show
                when={state().items.length}
                fallback={<p class="ui-slash__empty">Aucun résultat</p>}
              >
                <For each={state().items}>
                  {(item, i) => (
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i() === state().index}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          run(item, state().range);
                          setSlash(null);
                        }}
                      >
                        <span class="ui-slash__icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    </li>
                  )}
                </For>
              </Show>
            </div>
          </Portal>
        )}
      </Show>
      <MediaPicker
        open={!!picker()}
        onClose={() => setPicker(null)}
        onSelect={(media) => {
          editor()?.chain().focus().setImage(textImage(media)).run();
        }}
      />
    </div>
  );
}

export { SLASH_ITEMS };
