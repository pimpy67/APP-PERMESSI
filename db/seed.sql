-- =====================================================================
-- Richiesta e approvazione di permessi lavorativi: dati di test
-- Da eseguire dopo schema.sql:
--   psql -U utente_app -d permessi -f db/seed.sql
--
-- Tutti gli utenti hanno la stessa password: Password123!
-- (hash bcrypt con costo 12, generati con bcryptjs)
--
-- Utenti:
--   Responsabili: laura.bianchi@azienda.example, marco.ferri@azienda.example
--   Dipendenti:   mario.rossi, giulia.verdi, luca.esposito, sara.colombo,
--                 paolo.ricci (@azienda.example)
--                 elena.marino@azienda.example non ha richieste (caso "elenco vuoto")
--
-- Le richieste coprono settembre-dicembre 2026 e includono:
--   - richieste in attesa (modificabili ed eliminabili dal dipendente)
--   - richieste approvate e rifiutate (non modificabili dal dipendente)
--   - richieste di un solo giorno e di più giorni
--   - una richiesta a cavallo tra ottobre e novembre (caso limite per le statistiche mensili)
--   - più dipendenti e più mesi, per provare i filtri delle statistiche
-- =====================================================================

BEGIN;

-- Svuota le tabelle e riparte con gli id da 1, così lo script si può rieseguire.
TRUNCATE richieste_permesso, categorie_permesso, utenti RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Utenti
-- ---------------------------------------------------------------------
INSERT INTO utenti (nome, cognome, email, password_hash, ruolo) VALUES
  ('Laura', 'Bianchi',  'laura.bianchi@azienda.example', '$2a$12$alvKs7gYG3Fm/CS6HPdAgOOHXaDVcOmHZng.yRuqSpkFMZYQht7bq', 'Responsabile'),
  ('Marco', 'Ferri',    'marco.ferri@azienda.example',   '$2a$12$V/hu0XnTK/.vMmNH6aQUkeIVq11UCUOMKi6ldYo6Yo/cPnCcsJK3.', 'Responsabile'),
  ('Mario', 'Rossi',    'mario.rossi@azienda.example',   '$2a$12$0.2lKXVy15CaZvFuKABmNO2jVrivKAMeXFb/EXAkGQMqfiLjNcPXG', 'Dipendente'),
  ('Giulia','Verdi',    'giulia.verdi@azienda.example',  '$2a$12$AmGQZhj4j2aOMNQ9e/CsuOYLzHbxe4G51ZOG7DAb22N4FXjmzFTIe', 'Dipendente'),
  ('Luca',  'Esposito', 'luca.esposito@azienda.example', '$2a$12$F4y3zKQP0IZeaav07waANenMAJ6BPxjwqcTMsq8Z47vPR1iuIQKom', 'Dipendente'),
  ('Sara',  'Colombo',  'sara.colombo@azienda.example',  '$2a$12$TXrsMAO1kMSuf/1V05M1YeISdeNJxJG1/Iwfm7iEzw3BlPKhNiJEG', 'Dipendente'),
  ('Paolo', 'Ricci',    'paolo.ricci@azienda.example',   '$2a$12$9X53pOKYwLy.MlMK2wiYA.Tl5rSEhLzcFAFyPDf4Q6YxRu66zp6YW', 'Dipendente'),
  ('Elena', 'Marino',   'elena.marino@azienda.example',  '$2a$12$/mh2BxA78z.l0hHM3qSk9.S.qErJCbQbaSfE/WUayF2BDiJgLKNpu', 'Dipendente');

-- ---------------------------------------------------------------------
-- Categorie
-- ---------------------------------------------------------------------
INSERT INTO categorie_permesso (descrizione) VALUES
  ('Ferie'),
  ('Visita medica'),
  ('Permesso personale'),
  ('Motivi familiari'),
  ('Formazione');

-- ---------------------------------------------------------------------
-- Richieste
-- Gli id di utenti e categorie si ricavano da email e descrizione,
-- così il seed non dipende dai valori generati dalle colonne IDENTITY.
-- ---------------------------------------------------------------------
INSERT INTO richieste_permesso
  (utente_id, categoria_id, data_richiesta, data_inizio, data_fine,
   motivazione, stato, data_valutazione, utente_valutazione_id)
SELECT u.utente_id,
       c.categoria_id,
       v.data_richiesta::timestamptz,
       v.data_inizio::date,
       v.data_fine::date,
       v.motivazione,
       v.stato,
       v.data_valutazione::timestamptz,
       r.utente_id
FROM (VALUES
  -- Mario Rossi
  ('mario.rossi@azienda.example',   'Ferie',              '2026-08-20 09:15', '2026-09-07', '2026-09-11', 'Vacanza estiva posticipata',              'Approvato', '2026-08-21 10:00', 'laura.bianchi@azienda.example'),
  ('mario.rossi@azienda.example',   'Visita medica',      '2026-10-01 08:30', '2026-10-06', '2026-10-06', 'Visita cardiologica di controllo',        'Approvato', '2026-10-01 14:20', 'laura.bianchi@azienda.example'),
  ('mario.rossi@azienda.example',   'Ferie',              '2026-10-15 11:00', '2026-10-29', '2026-11-03', 'Ponte di Ognissanti',                     'Approvato', '2026-10-16 09:00', 'marco.ferri@azienda.example'),
  ('mario.rossi@azienda.example',   'Ferie',              '2026-11-02 16:45', '2026-12-21', '2026-12-31', 'Vacanze di Natale',                       'In attesa', NULL,               NULL),

  -- Giulia Verdi
  ('giulia.verdi@azienda.example',  'Formazione',         '2026-09-01 10:00', '2026-09-24', '2026-09-25', 'Corso di aggiornamento su sicurezza informatica', 'Approvato', '2026-09-02 12:00', 'marco.ferri@azienda.example'),
  ('giulia.verdi@azienda.example',  'Ferie',              '2026-10-05 09:00', '2026-10-19', '2026-10-23', 'Viaggio programmato da tempo',            'Rifiutato', '2026-10-06 17:30', 'marco.ferri@azienda.example'),
  ('giulia.verdi@azienda.example',  'Ferie',              '2026-10-07 09:10', '2026-11-16', '2026-11-20', 'Viaggio spostato a novembre',             'Approvato', '2026-10-08 10:15', 'marco.ferri@azienda.example'),
  ('giulia.verdi@azienda.example',  'Visita medica',      '2026-11-05 13:00', '2026-11-12', '2026-11-12', 'Visita oculistica',                       'In attesa', NULL,               NULL),

  -- Luca Esposito
  ('luca.esposito@azienda.example', 'Motivi familiari',   '2026-09-14 07:50', '2026-09-15', '2026-09-16', 'Assistenza a un familiare',               'Approvato', '2026-09-14 09:05', 'laura.bianchi@azienda.example'),
  ('luca.esposito@azienda.example', 'Permesso personale', '2026-10-20 15:00', '2026-10-27', '2026-10-27', 'Trasloco',                                'Approvato', '2026-10-21 08:45', 'laura.bianchi@azienda.example'),
  ('luca.esposito@azienda.example', 'Ferie',              '2026-11-03 10:30', '2026-11-23', '2026-11-27', 'Settimana di riposo',                     'Rifiutato', '2026-11-04 11:00', 'laura.bianchi@azienda.example'),
  ('luca.esposito@azienda.example', 'Ferie',              '2026-11-06 09:20', '2026-12-07', '2026-12-11', 'Settimana di riposo (nuove date)',        'In attesa', NULL,               NULL),

  -- Sara Colombo
  ('sara.colombo@azienda.example',  'Ferie',              '2026-08-25 12:00', '2026-09-14', '2026-09-18', 'Matrimonio di un amico all''estero',      'Approvato', '2026-08-26 09:30', 'marco.ferri@azienda.example'),
  ('sara.colombo@azienda.example',  'Visita medica',      '2026-10-09 08:00', '2026-10-13', '2026-10-13', 'Esami del sangue',                        'Approvato', '2026-10-09 10:10', 'marco.ferri@azienda.example'),
  ('sara.colombo@azienda.example',  'Visita medica',      '2026-11-04 08:15', '2026-11-10', '2026-11-10', 'Visita dermatologica',                    'Approvato', '2026-11-04 12:40', 'laura.bianchi@azienda.example'),
  ('sara.colombo@azienda.example',  'Permesso personale', '2026-11-07 18:00', '2026-11-19', '2026-11-19', 'Pratiche in Comune',                      'In attesa', NULL,               NULL),

  -- Paolo Ricci
  ('paolo.ricci@azienda.example',   'Permesso personale', '2026-09-28 14:00', '2026-09-30', '2026-09-30', 'Rinnovo documenti',                       'Rifiutato', '2026-09-29 09:00', 'laura.bianchi@azienda.example'),
  ('paolo.ricci@azienda.example',   'Ferie',              '2026-10-12 10:00', '2026-11-02', '2026-11-06', 'Visita ai parenti',                       'Approvato', '2026-10-13 15:00', 'laura.bianchi@azienda.example'),
  ('paolo.ricci@azienda.example',   'Formazione',         '2026-11-08 09:00', '2026-12-02', '2026-12-04', 'Conferenza di settore a Milano',          'In attesa', NULL,               NULL)
) AS v(email, categoria, data_richiesta, data_inizio, data_fine,
       motivazione, stato, data_valutazione, email_responsabile)
JOIN utenti u             ON u.email = v.email
JOIN categorie_permesso c ON c.descrizione = v.categoria
LEFT JOIN utenti r        ON r.email = v.email_responsabile;

COMMIT;
