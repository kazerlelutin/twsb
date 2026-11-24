-- Titre et description servent aussi au référencement : un seul champ chacun.
UPDATE contents SET excerpt = substr(seo_description, 1, 500)
  WHERE excerpt = '' AND seo_description <> '';
UPDATE contents SET seo_title = '', seo_description = '';

-- Multilingue : langue du contenu ('' = langue principale) et contenu source.
CREATE TABLE contents_next (
  id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  blocks TEXT NOT NULL DEFAULT '[]',
  cover_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  lang TEXT NOT NULL DEFAULT '',
  translation_of TEXT,
  UNIQUE (type_id, lang, slug)
);
INSERT INTO contents_next (id, type_id, title, slug, status, excerpt, body, blocks, cover_id, seo_title, seo_description, author_id, published_at, created_at, updated_at, data)
  SELECT id, type_id, title, slug, status, excerpt, body, blocks, cover_id, seo_title, seo_description, author_id, published_at, created_at, updated_at, data FROM contents;
DROP TABLE contents;
ALTER TABLE contents_next RENAME TO contents;
CREATE INDEX contents_listing ON contents(type_id, status, published_at DESC);
CREATE INDEX contents_translation ON contents(translation_of);
