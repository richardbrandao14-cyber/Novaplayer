-- Avaliação pessoal é separada da classificação fornecida pelo catálogo.
ALTER TABLE library_state ADD COLUMN feedback INTEGER NOT NULL DEFAULT 0 CHECK(feedback IN (-1,0,1));
PRAGMA user_version=3;
