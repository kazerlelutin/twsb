-- Historique : l'état de chaque élément après chaque action (création, modification, suppression, restauration).
CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  label TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX revisions_entity ON revisions(entity, entity_id, created_at DESC);
CREATE INDEX revisions_date ON revisions(created_at);
