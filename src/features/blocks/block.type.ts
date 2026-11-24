export type Device = "desktop" | "mobile";

export type Spacing = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type BlockStyle = {
  padding?: Spacing;
  margin?: Spacing;
  background?: string;
  backgroundImage?: string;
  overlay?: number;
  color?: string;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  minHeight?: number;
  radius?: number;
  fontSize?: number;
  gap?: number;
  shadow?: boolean;
  border?: string;
  hidden?: boolean;
};

export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: Partial<Record<Device, BlockStyle>>;
  children?: Block[];
};

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "range"
  | "color"
  | "select"
  | "toggle"
  | "media"
  | "url"
  | "list"
  | "menu"
  | "contentType"
  | "spacing"
  | "code"
  | "tag"
  | "contentField";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  fields?: FieldDef[];
  itemLabel?: string;
  /** Le champ n'est proposé que si la condition est remplie. */
  when?: (
    values: Record<string, unknown>,
    context: { type: string },
  ) => boolean;
};

export type BlockCategory =
  | "fields"
  | "layout"
  | "basic"
  | "media"
  | "composite"
  | "dynamic"
  | "site";

export type BlockDef = {
  type: string;
  label: string;
  icon: string;
  category: BlockCategory;
  fields: FieldDef[];
  defaults: () => Record<string, unknown>;
  container?: boolean;
  /** Enfants imposés : seul ce type peut être ajouté dedans. */
  childType?: string;
  /** Contexte d'apparition dans la palette. */
  scope?: ("content" | "layout" | "template")[];
  hidden?: boolean;
};

export type EditorScope = "content" | "layout" | "template";
