# Endpoint dell'API

Tutti i percorsi iniziano con `http://localhost:3000`.
Corpi di richiesta e risposta sono in JSON. In caso di errore la risposta è sempre `{ "errore": "messaggio" }`.

**Legenda**

- **Auth**: *no* = rotta aperta; *sì* = serve l'header `Authorization: Bearer <token>` ottenuto dal login.
- **Ruolo**: chi può chiamare la rotta. *Tutti* = qualsiasi utente autenticato.
- **Stato**: ✅ implementato, ⏳ da implementare.

## Riepilogo

| # | Metodo | Percorso | Descrizione | Auth | Ruolo | Stato |
|---|--------|----------|-------------|------|-------|-------|
| 1 | `POST` | `/api/utenti/register` | Registrazione di un nuovo utente | no | – | ✅ |
| 2 | `POST` | `/api/utenti/login` | Login, restituisce il token JWT | no | – | ✅ |
| 3 | `GET` | `/api/utenti/me` | Dati dell'utente collegato | sì | Tutti | ✅ |
| 4 | `GET` | `/api/categorie` | Elenco delle categorie di permesso | sì | Tutti | ⏳ |
| 5 | `GET` | `/api/richieste` | Elenco delle richieste | sì | Tutti (vedi regole) | ⏳ |
| 6 | `GET` | `/api/richieste/da-approvare` | Richieste in attesa di valutazione | sì | Responsabile | ⏳ |
| 7 | `GET` | `/api/richieste/:id` | Dettaglio di una richiesta | sì | Tutti (vedi regole) | ⏳ |
| 8 | `POST` | `/api/richieste` | Nuova richiesta di permesso | sì | Dipendente | ⏳ |
| 9 | `PUT` | `/api/richieste/:id` | Modifica di una richiesta | sì | Dipendente (vedi regole) | ⏳ |
| 10 | `DELETE` | `/api/richieste/:id` | Eliminazione di una richiesta | sì | Tutti (vedi regole) | ⏳ |
| 11 | `PUT` | `/api/richieste/:id/approva` | Approvazione di una richiesta | sì | Responsabile | ⏳ |
| 12 | `PUT` | `/api/richieste/:id/rifiuta` | Rifiuto di una richiesta | sì | Responsabile | ⏳ |
| 13 | `GET` | `/api/statistiche` | Giorni approvati per dipendente e mese | sì | Responsabile | ⏳ |
| 14 | `GET` | `/api/salute` | Verifica che l'API raggiunga il database | no | – | ✅ |

Le rotte 1–12 sono quelle chieste dalla traccia, la 13 è il requisito avanzato, la 14 è di servizio.
In Express `/api/richieste/da-approvare` va dichiarata **prima** di `/api/richieste/:id`, altrimenti "da-approvare" viene letto come un id.

## Come leggere le tabelle: l'input rende la risposta "dinamica"

Ogni endpoint è **un solo pezzo di codice** in `server.js`, ma l'**input** cambia a ogni chiamata e quindi cambia anche la risposta.
L'input è il "modulo compilato" che il client consegna: il server lo legge, lo mette nella query al posto di `$1, $2...` e risponde in base al risultato.

Esempio con `POST /api/utenti/login`, sempre lo stesso codice:

- Mario manda `{ "email": "mario.rossi@azienda.example", "password": "Password123!" }` → riceve il token di Mario
- Laura manda la sua email → riceve il token di Laura
- qualcuno sbaglia la password → riceve `401`

**L'input può arrivare da 4 posti diversi**

| Dove | Esempio | Nel codice |
|------|---------|------------|
| **corpo** JSON (in POST e PUT) | `{ email, password }` | `req.body.email` |
| **URL**, parametro nel percorso | `/api/richieste/5` | `req.params.id` |
| **URL**, query string dopo il `?` | `/api/statistiche?mese=2026-10` | `req.query.mese` |
| **header** con il token | `Authorization: Bearer ...` | `req.utente.id` (lo imposta `autentica`) |

Per questo `GET /api/utenti/me` ha "–" come input: non ha corpo né parametri, eppure ognuno riceve i propri dati, perché il server sa chi sei dal **token**.

**Le colonne delle tabelle qui sotto**

- **Input**: cosa manda il client e dove (corpo, URL, query string). Il token non è indicato perché è nella colonna *Auth* del riepilogo.
- **Risposta OK**: codice di stato e JSON che tornano quando va tutto bene.
- **Errori**: cosa torna quando l'input è sbagliato (`400`), non sei autenticato (`401`), non hai il permesso (`403`), la risorsa non c'è (`404`) o c'è un conflitto (`409`).

## Dettaglio

### Utenti

| Metodo e percorso | Input | Risposta OK | Errori |
|-------------------|-------|-------------|--------|
| `POST /api/utenti/register` | corpo `{ nome, cognome, email, password }` | `201 { id, nome, cognome, email, ruolo }` | `400` campi mancanti o non validi · `409` email già registrata |
| `POST /api/utenti/login` | corpo `{ email, password }` | `200 { token, utente: { id, email, ruolo } }` | `400` campi mancanti · `401` credenziali non valide |
| `GET /api/utenti/me` | – | `200 { id, nome, cognome, email, ruolo }` | `401` token mancante, scaduto o non valido |

Validazione della registrazione: nome e cognome non vuoti e al massimo 50 caratteri, email con `@` e al massimo 100 caratteri, password di almeno 8 caratteri.
Il ruolo non viene mai preso dal client: ogni nuovo utente è `Dipendente`.

### Categorie

| Metodo e percorso | Input | Risposta OK | Errori |
|-------------------|-------|-------------|--------|
| `GET /api/categorie` | – | `200 [ { id, descrizione } ]` | `401` |

### Richieste di permesso

| Metodo e percorso | Input | Risposta OK | Errori |
|-------------------|-------|-------------|--------|
| `GET /api/richieste` | – | `200 [ richiesta ]` | `401` |
| `GET /api/richieste/da-approvare` | – | `200 [ richiesta ]` con stato `In attesa` | `401` · `403` non responsabile |
| `GET /api/richieste/:id` | `id` intero positivo | `200 richiesta` | `400` id non valido · `401` · `403` richiesta di un altro dipendente · `404` non esiste |
| `POST /api/richieste` | corpo `{ data_inizio, data_fine, categoria_id, motivazione }` | `201 richiesta` | `400` dati non validi · `401` · `403` non dipendente |
| `PUT /api/richieste/:id` | `id` + corpo come la `POST` | `200 richiesta` | `400` · `401` · `403` non è tua · `404` · `409` non più in attesa |
| `DELETE /api/richieste/:id` | `id` | `204` senza corpo | `400` · `401` · `403` non consentito · `404` |
| `PUT /api/richieste/:id/approva` | `id` | `200 richiesta` con stato `Approvato` | `400` · `401` · `403` · `404` · `409` già valutata |
| `PUT /api/richieste/:id/rifiuta` | `id` | `200 richiesta` con stato `Rifiutato` | `400` · `401` · `403` · `404` · `409` già valutata |

Una *richiesta* nella risposta contiene:
`{ id, data_richiesta, data_inizio, data_fine, categoria: { id, descrizione }, motivazione, stato, richiedente: { id, nome, cognome }, data_valutazione, valutatore: { id, nome, cognome } | null }`.

**Validazione dei dati della richiesta**

- `data_inizio` e `data_fine` nel formato `AAAA-MM-GG` e date esistenti;
- `data_fine` uguale o successiva a `data_inizio`;
- `categoria_id` intero di una categoria esistente;
- `motivazione` testo non vuoto.
- Stato, richiedente e valutazione non vengono mai presi dal client: li imposta il server.

**Regole per ruolo**

| Operazione | Dipendente | Responsabile |
|------------|------------|--------------|
| Vedere l'elenco e il dettaglio | solo le proprie richieste | tutte |
| Creare | sì, a proprio nome | no |
| Modificare | solo le proprie e solo se `In attesa` | no |
| Eliminare | solo le proprie e solo se `In attesa` | tutte, anche approvate o rifiutate |
| Approvare / rifiutare | no | solo se `In attesa` |

All'approvazione e al rifiuto il server imposta `data_valutazione = now()` e `utente_valutazione_id` = id del responsabile collegato.

### Statistiche (requisito avanzato)

| Metodo e percorso | Input | Risposta OK | Errori |
|-------------------|-------|-------------|--------|
| `GET /api/statistiche` | query facoltative `utente_id` (intero) e `mese` (`AAAA-MM`) | `200 [ { utente: { id, nome, cognome }, mese, giorni } ]` | `400` filtri non validi · `401` · `403` non responsabile |

Conta solo le richieste con stato `Approvato`. Prima di implementarla va deciso:

- se contare i giorni di calendario o solo quelli lavorativi;
- come dividere una richiesta a cavallo di due mesi (es. dal 29/10 al 03/11 nei dati di test).

### Servizio

| Metodo e percorso | Input | Risposta OK | Errori |
|-------------------|-------|-------------|--------|
| `GET /api/salute` | – | `200 { "database": "raggiungibile" }` | `500` database non raggiungibile |

## Codici di stato usati

| Codice | Significato |
|--------|-------------|
| `200` OK | operazione riuscita, con dati nella risposta |
| `201` Created | risorsa creata |
| `204` No Content | eliminazione riuscita, nessun corpo |
| `400` Bad Request | dati mancanti o non validi, JSON malformato |
| `401` Unauthorized | token mancante, scaduto o non valido, oppure credenziali errate |
| `403` Forbidden | utente autenticato ma senza il permesso per l'operazione |
| `404` Not Found | risorsa o rotta inesistente |
| `409` Conflict | email già registrata, oppure richiesta non più modificabile perché già valutata |
| `500` Internal Server Error | errore imprevisto del server |

## Rotte del vecchio playground

In `api/server.js` restano rotte di esercitazione che non fanno parte dell'app e andranno tolte o lasciate solo come esempio:

| Metodo e percorso | Note |
|-------------------|------|
| `GET /api/esempi/hash?testo=` | confronto MD5 / SHA-256 / bcrypt, usata in `mock.http` |
| `POST /api/esempi/hash/verifica` | verifica di un hash bcrypt, usata in `mock.http` |
| `GET /api/esempi/ricerca-sicura` | non funziona: usa colonne `id` e `attivo` che non esistono più |
| `GET /api/esempi/ricerca-vulnerabile` | come sopra; attiva solo con `ESEMPI_VULNERABILI=true` |
| `GET /api/utenti`, `GET /api/utenti/:id`, `GET /api/utenti/conteggio` | stub che rispondono `501` |
