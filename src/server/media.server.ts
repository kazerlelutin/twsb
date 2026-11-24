import fs from "node:fs/promises";
import path from "node:path";
import type { MediaInfo, MediaVariant } from "../features/site/site.type";
import { uid } from "./db.server";
import { env } from "./env.server";
import { deleteMediaRow, getMedia, insertMedia } from "./repo.server";

export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920];
export const MAX_UPLOAD = 25 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
};

const RASTER = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export const mediaRoot = () => path.join(env().dataDir, "media");
export const mediaDir = (id: string) => path.join(mediaRoot(), id);

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

/** Enregistre l'original et génère les largeurs utiles en webp. */
export async function storeUpload(file: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<MediaInfo> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new MediaError("Format non pris en charge.");
  if (file.bytes.byteLength > MAX_UPLOAD)
    throw new MediaError("Fichier trop lourd (25 Mo max).");
  const id = uid();
  const dir = mediaDir(id);
  await fs.mkdir(dir, { recursive: true });
  const variants: MediaVariant[] = [];
  let width: number | null = null;
  let height: number | null = null;
  let original = Buffer.from(file.bytes);

  if (file.type === "image/svg+xml") {
    const text = original.toString("utf8");
    if (/<script|on\w+\s*=|javascript:/i.test(text))
      throw new MediaError("SVG refusé : contenu actif.");
  }

  if (RASTER.has(file.type)) {
    const sharp = await loadSharp();
    // Applique l'orientation EXIF puis retire les métadonnées de l'original.
    const rotated = sharp(original, {
      animated: file.type === "image/gif",
    }).rotate();
    const meta = await rotated.metadata();
    if (file.type === "image/jpeg" || file.type === "image/png") {
      original = await rotated.toBuffer();
    }
    const info = await sharp(original).metadata();
    width = info.width ?? meta.width ?? null;
    height = info.pageHeight ?? info.height ?? meta.height ?? null;
    if (width && height && file.type !== "image/gif") {
      const targets = VARIANT_WIDTHS.filter((w) => w < width!);
      targets.push(Math.min(width, 2560));
      for (const target of [...new Set(targets)]) {
        const out = await sharp(original)
          .resize({ width: target, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        const name = `w${target}.webp`;
        await fs.writeFile(path.join(dir, name), out.data);
        variants.push({
          width: out.info.width,
          height: out.info.height,
          file: name,
          format: "webp",
        });
      }
    }
  }

  await fs.writeFile(path.join(dir, `original.${ext}`), original);
  return insertMedia({
    id,
    name: file.name.slice(0, 200) || `fichier.${ext}`,
    mime: file.type,
    ext,
    size: original.byteLength,
    width,
    height,
    alt: "",
    variants,
    createdAt: Date.now(),
  });
}

export async function removeMedia(id: string) {
  if (!getMedia(id)) return false;
  deleteMediaRow(id);
  await fs.rm(mediaDir(id), { recursive: true, force: true });
  return true;
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED).map(([mime, ext]) => [ext, mime]),
);

/** Lit un fichier média en refusant toute sortie du dossier. */
export async function readMediaFile(id: string, file: string) {
  if (!/^[\w-]+$/.test(id) || !/^[\w.-]+$/.test(file) || file.includes(".."))
    return undefined;
  const target = path.join(mediaDir(id), file);
  try {
    const data = await fs.readFile(target);
    const ext = file.split(".").pop() ?? "";
    return { data, type: MIME_BY_EXT[ext] ?? "application/octet-stream" };
  } catch {
    return undefined;
  }
}

/** Icône carrée générée depuis le favicon de l'identité, mise en cache sur disque. */
export async function iconPng(mediaId: string, size: number) {
  const media = getMedia(mediaId);
  if (!media) return undefined;
  const cache = path.join(mediaDir(mediaId), `icon-${size}.png`);
  try {
    return await fs.readFile(cache);
  } catch {
    const source = await readMediaFile(mediaId, `original.${media.ext}`);
    if (!source) return undefined;
    const sharp = await loadSharp();
    const png = await sharp(source.data)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await fs.writeFile(cache, png);
    return png;
  }
}

export class MediaError extends Error {}
