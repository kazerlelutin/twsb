-- Un seul mode : le type est la mise en page, le contenu remplit ses champs.
-- Les types sans modèle reçoivent le modèle par défaut (couverture, titre, méta, corps).
UPDATE content_types
  SET template = '[{"id":"t-section","type":"section","props":{"width":"container"},"children":[{"id":"t-cover","type":"content-cover","props":{"fit":"21/9"}},{"id":"t-title","type":"content-title","props":{}},{"id":"t-meta","type":"content-meta","props":{"showDate":true,"showAuthor":true}},{"id":"t-body","type":"content-body","props":{}}]}]'
  WHERE template = '[]';
UPDATE content_types
  SET editor = 'document',
      has_body = CASE WHEN template LIKE '%"content-body"%' THEN 1 ELSE 0 END;
