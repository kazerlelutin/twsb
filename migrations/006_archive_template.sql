-- Page de liste d'un type (/blog…) : sa propre mise en page en blocs.
ALTER TABLE content_types ADD COLUMN archive_template TEXT NOT NULL DEFAULT '[]';
