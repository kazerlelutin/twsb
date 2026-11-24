ALTER TABLE content_types ADD COLUMN fields TEXT NOT NULL DEFAULT '[]';
ALTER TABLE content_types ADD COLUMN has_body INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contents ADD COLUMN data TEXT NOT NULL DEFAULT '{}';

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE content_tags (
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);
CREATE INDEX content_tags_tag ON content_tags(tag_id);

-- Anciennes adresses d'un contenu publié : redirigées en 301.
CREATE TABLE redirects (
  path TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
