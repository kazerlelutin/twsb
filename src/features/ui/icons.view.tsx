import type { JSX } from "solid-js";

const PATHS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  plugin: "M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  left: "m15 6-6 6 6 6",
  right: "m9 6 6 6-6 6",
  desktop: "M3 4h18v12H3zM8 20h8M12 16v4",
  mobile: "M7 2h10v20H7zM11 18h2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  save: "M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7",
  back: "M19 12H5M11 6l-6 6 6 6",
  image: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15 9a1.5 1.5 0 1 0 0-.01",
  x: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  file: "M6 2h8l5 5v15H6zM14 2v5h5",
  layout: "M3 3h18v18H3zM3 9h18M9 21V9",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  users:
    "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  palette:
    "M12 2a10 10 0 1 0 0 20c1 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a5 5 0 0 0 5-5c0-5-4.5-9-10-9zM7 12h.01M9 7h.01M15 7h.01",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  database:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  logout: "M9 21H4V3h5M16 17l5-5-5-5M21 12H9",
  external: "M14 3h7v7M21 3l-9 9M19 14v7H3V5h7",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z",
  indent: "M3 8l4 4-4 4M11 6h10M11 12h10M11 18h10",
  outdent: "M7 8l-4 4 4 4M11 6h10M11 12h10M11 18h10",
  check: "m5 12 5 5 9-11",
};

export type IconName = keyof typeof PATHS | string;

export function Icon(
  props: {
    name: IconName;
    label?: string;
  } & JSX.SvgSVGAttributes<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={props.label ? undefined : "true"}
      role={props.label ? "img" : undefined}
      aria-label={props.label}
    >
      <path d={PATHS[props.name] ?? ""} />
    </svg>
  );
}
