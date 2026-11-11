# CLAUDE.md

Monorepo dell'app d'esame **"Richiesta e approvazione di permessi lavorativi"**.
Rispondi sempre in **italiano**.

La traccia completa è in `traccia-esame.md`. Prima di modificare qualcosa leggi anche `README.md`, `api/server.js`, `db/schema.sql` e `db/seed.sql`.

## Struttura

- `docker-compose.yml` (root): `postgres:17` (container `app-permessi-postgres`, porta 5432) e `pgadmin4:9` (container `app-permessi-pgadmin`, http://localhost:5050, senza login, server "permessi (Docker)" già configurato da `db/pgadmin/servers.json`).
  - Database `permessi`, utente `utente_app`. I dati stanno nel volume Docker `pgdata`, non sul disco.
  - `db/schema.sql` (montato come `01_schema.sql`) e `db/seed.sql` (`02_seed.sql`) vengono eseguiti solo quando il volume è vuoto.
  - Per ripartire da zero: `docker compose down -v && docker compose up -d`.
- `api/`: backend Express 5 in ESM, Node 24, con `pg`, `bcryptjs` (costo 12) e `jsonwebtoken`. Si avvia con `cd api && npm run dev` (`node --watch --env-file=.env`), porta 3000.
  - In `api/.env` ci sono `DATABASE_URL` (…/permessi), `PORT`, `ESEMPI_VULNERABILI`, `JWT_SECRET` (minimo 32 caratteri, altrimenti il server non parte) e `JWT_EXPIRES_IN=1h`. `api/.env.example` è allineato.
- `api/mock/mock.http`: richieste per l'estensione REST Client di VS Code (`humao.rest-client`).
  - Variabili (`@baseUrl`, `@email`, `@password`, `@token`) tutte in testa: niente righe tra il corpo di una richiesta e il `###` successivo, perché REST Client le spedirebbe nel corpo.
  - Contiene health, register (email con `{{$timestamp}}`), login (`# @name login`, poi `@token = {{login.response.body.token}}`), `/utenti/me` con e senza token, hash e verifica bcrypt (`# @name hashEsempio`).
- `docs/`: spiegazioni per gli studenti, che conoscono le basi dei database.
  - `endpoint.md`: tabella di tutti gli endpoint (implementati e da fare), con input, risposte, errori e regole per ruolo. Aggiornala quando aggiungi o cambi un endpoint.
  - `query-seed-richieste.md` spiega passo per passo l'`INSERT ... SELECT` delle richieste in `db/seed.sql`. Se cambi quella query, aggiorna anche questo file.
- `.gitignore` in root: `node_modules/`, `.env`.

## Database (`db/schema.sql`)

- `utenti`: `utente_id`, `nome`, `cognome`, `email` (`UNIQUE`, distingue maiuscole e minuscole), `password_hash`, `ruolo` (`Dipendente` | `Responsabile`, default `Dipendente`), `data_creazione`.
- `categorie_permesso`: `categoria_id`, `descrizione` (unica).
- `richieste_permesso`: `richiesta_id`, `data_richiesta`, `data_inizio`, `data_fine`, `categoria_id`, `motivazione`, `stato` (`In attesa` | `Approvato` | `Rifiutato`), `utente_id`, `data_valutazione`, `utente_valutazione_id`.
  - Vincoli CHECK: `data_fine >= data_inizio`; "In attesa" ⇔ nessuna valutazione; Approvato/Rifiutato ⇒ `data_valutazione` presente.
- Seed: 8 utenti, tutti con password `Password123!`.
  - Responsabili: `laura.bianchi@azienda.example`, `marco.ferri@azienda.example`.
  - Dipendenti: `mario.rossi`, `giulia.verdi`, `luca.esposito`, `sara.colombo`, `paolo.ricci`, `elena.marino` (quest'ultima senza richieste), tutti `@azienda.example`.
  - 5 categorie; 19 richieste da settembre a dicembre 2026 (11 approvate, 5 in attesa, 3 rifiutate), tra cui una dal 29/10 al 03/11, a cavallo di due mesi.

## API già presenti (`api/server.js`)

- Middleware `logChiamate`, registrato prima di `express.json()`: una riga per chiamata con data, metodo, percorso, stato, durata e utente. Non registra mai query string, corpo o header.
- Middleware `autentica`: legge `Authorization: Bearer`, verifica il token (solo HS256) e imposta `req.utente = { id, ruolo }`. Altrimenti 401 ("Token mancante" / "Token scaduto" / "Token non valido") con `WWW-Authenticate`.
- `richiediRuolo(...ruoli)` e `soloResponsabili`: da usare dopo `autentica`; 403 se il ruolo non è ammesso, 401 se manca `req.utente`.
- `POST /api/utenti/register`: `{ nome, cognome, email, password }`, validati. Il ruolo non viene mai preso dal client. Risponde 201 `{ id, nome, cognome, email, ruolo }`, 409 se l'email esiste già.
- `POST /api/utenti/login`: cerca con `lower(email) = lower($1)`. Risponde 200 `{ token, utente: { id, email, ruolo } }`, 401 "Credenziali non valide". Il payload JWT è `{ sub, ruolo }`.
- `GET /api/utenti/me` (autenticata): `{ id, nome, cognome, email, ruolo }`.
- `GET /api/esempi/hash?testo=` restituisce md5, sha256 e bcrypt. `POST /api/esempi/hash/verifica` riceve `{ testo, hash }` e risponde `{ valido }`.
- Resti del vecchio playground ancora presenti:
  - `/api/esempi/ricerca-sicura` e `/ricerca-vulnerabile` usano le colonne `id` e `attivo`, che non esistono più, quindi sono rotte rotte;
  - ESERCIZI 1, 2 e 5 sono stub che rispondono 501;
  - `/api/utenti/conteggio` è dichiarata dopo `/api/utenti/:id`.

## Regole di lavoro

- Niente `HASH_FITTIZIO`: il login risponde subito 401 se l'email non esiste. È una scelta dell'utente, non riproporla.
- Query sempre parametrizzate, mai `SELECT *`, mai password, hash o token nei log o nelle risposte.
- Validazione server-side di ogni input.
- Le rotte con un percorso fisso (es. `/da-approvare`, `/me`) vanno dichiarate prima di quelle con parametro (`/:id`).
- Quando fai test, non fermare il `npm run dev` dell'utente: usa un'istanza temporanea con `PORT=3001` e poi chiudila. Se crei dati di prova nel database, cancellali alla fine.
- Quando aggiungi endpoint, aggiorna `api/mock/mock.http` e la sezione "Stato del progetto" del `README.md`. Tieni aggiornato anche questo file.
- Se trovi problemi fuori dal compito, segnalali senza correggerli.
- App didattica per la simulazione dell'esame di Stato: usa solo ciò che è stato fatto a lezione. Niente `CREATE INDEX` nello schema (scelta dell'utente); va bene che l'app non sia perfetta.
- Non fare commit se l'utente non lo chiede.

## Problemi aperti (segnalati, non ancora corretti)

- Il gestore degli errori fa `console.error(err)`: un errore di PostgreSQL può contenere l'email nel campo `detail`.
- `/api/esempi/hash` con `?testo=a&testo=b` va in 500.
- bcrypt usa solo i primi 72 byte della password e non c'è un limite massimo di lunghezza.
- Il commento in testa a `server.js` descrive ancora la vecchia tabella `utenti` del playground (colonne `id` e `attivo`).

## Prossimi passi (dalla traccia)

1. `GET /api/categorie` (autenticata).
2. CRUD su `/api/richieste`:
   - il dipendente vede, crea, modifica ed elimina solo le proprie richieste, e solo se "In attesa";
   - il responsabile vede tutte le richieste e può cancellare anche quelle approvate.
3. `GET /api/richieste/da-approvare`, `PUT /api/richieste/:id/approva` e `PUT /api/richieste/:id/rifiuta`, con `autentica` + `soloResponsabili`. Vanno impostati `data_valutazione` e `utente_valutazione_id`.
4. Endpoint delle statistiche (solo responsabili): giorni approvati per dipendente e mese, con filtri opzionali. Prima va deciso con l'utente se contare i giorni di calendario o quelli lavorativi e come trattare le richieste a cavallo di due mesi.
5. Poi: frontend CSR, eventuale Swagger, deployment.
