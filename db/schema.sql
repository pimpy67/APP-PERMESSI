-- =====================================================================
-- Richiesta e approvazione di permessi lavorativi: schema del database
-- PostgreSQL 17
--
-- Esecuzione (da eseguire in un database dedicato, ad esempio "permessi"):
--   psql -U utente_app -d permessi -f db/schema.sql
--
-- ATTENZIONE: lo script elimina e ricrea le tabelle, quindi cancella
-- tutti i dati presenti. Serve a poter ripartire da zero durante lo sviluppo.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS richieste_permesso;
DROP TABLE IF EXISTS categorie_permesso;
DROP TABLE IF EXISTS utenti;

-- ---------------------------------------------------------------------
-- Utenti
-- La password non viene mai salvata in chiaro: si salva solo l'hash bcrypt.
-- ---------------------------------------------------------------------
CREATE TABLE utenti (
    utente_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome           VARCHAR(50)  NOT NULL CHECK (btrim(nome) <> ''),
    cognome        VARCHAR(50)  NOT NULL CHECK (btrim(cognome) <> ''),
    email          VARCHAR(100) NOT NULL UNIQUE CHECK (position('@' IN email) > 1),
    password_hash  VARCHAR(255) NOT NULL,
    ruolo          VARCHAR(20)  NOT NULL DEFAULT 'Dipendente'
                   CHECK (ruolo IN ('Dipendente', 'Responsabile')),
    data_creazione TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Categorie di permesso (Ferie, Visita medica, ...)
-- ---------------------------------------------------------------------
CREATE TABLE categorie_permesso (
    categoria_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descrizione    VARCHAR(100) NOT NULL UNIQUE CHECK (btrim(descrizione) <> '')
);

-- ---------------------------------------------------------------------
-- Richieste di permesso
-- ---------------------------------------------------------------------
CREATE TABLE richieste_permesso (
    richiesta_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data_richiesta        TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_inizio           DATE        NOT NULL,
    data_fine             DATE        NOT NULL,
    categoria_id          INTEGER     NOT NULL REFERENCES categorie_permesso (categoria_id),
    motivazione           TEXT        NOT NULL CHECK (btrim(motivazione) <> ''),
    stato                 VARCHAR(20) NOT NULL DEFAULT 'In attesa'
                          CHECK (stato IN ('In attesa', 'Approvato', 'Rifiutato')),
    utente_id             INTEGER     NOT NULL REFERENCES utenti (utente_id) ON DELETE CASCADE,
    data_valutazione      TIMESTAMPTZ,
    utente_valutazione_id INTEGER     REFERENCES utenti (utente_id) ON DELETE SET NULL,

    CONSTRAINT richieste_date_ck CHECK (data_fine >= data_inizio),

    -- Una richiesta in attesa non ha ancora una data di valutazione.
    -- Una richiesta approvata o rifiutata ce l'ha sempre.
    -- Il responsabile può mancare solo se il suo account è stato eliminato (SET NULL).
    CONSTRAINT richieste_valutazione_ck CHECK (
        (stato = 'In attesa' AND data_valutazione IS NULL AND utente_valutazione_id IS NULL)
        OR (stato <> 'In attesa' AND data_valutazione IS NOT NULL)
    )
);

COMMIT;
