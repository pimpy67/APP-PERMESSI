# App Permessi

Applicazione web full stack per la **richiesta e l'approvazione di permessi lavorativi**.
I dipendenti chiedono permessi (ferie, visite mediche, altri motivi); i responsabili li approvano o li rifiutano.

La traccia completa è in [`traccia-esame.md`](traccia-esame.md).

## Struttura del progetto

Il progetto è un monorepo: backend, database e (in futuro) frontend vivono nello stesso repository, in cartelle separate.

```
app-permessi/
├── docker-compose.yml     PostgreSQL + pgAdmin per lo sviluppo
├── traccia-esame.md       testo della prova
├── api/                   backend: REST API con Express 5 e driver pg
│   ├── server.js
│   ├── package.json
│   ├── .env.example       variabili d'ambiente da copiare in .env
│   └── mock/
│       └── mock.http      richieste di prova per l'estensione REST Client
├── db/
│   ├── schema.sql         creazione delle tabelle
│   ├── seed.sql           dati di test
│   └── pgadmin/
│       └── servers.json   connessione al database già configurata in pgAdmin
└── docs/
    ├── endpoint.md               tabella di tutti gli endpoint dell'API
    └── query-seed-richieste.md   spiegazione passo per passo della query che inserisce le richieste
```

## Requisiti

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 20 o superiore

## Avvio

### 1. Database

Dalla root del progetto:

```bash
docker compose up -d
```

Vengono avviati due servizi:

| Servizio   | Indirizzo               | Note                                          |
|------------|-------------------------|-----------------------------------------------|
| PostgreSQL | `localhost:5432`        | database `permessi`, utente `utente_app`      |
| pgAdmin    | http://localhost:5050   | il server "permessi (Docker)" è già configurato |

I dati sono salvati nel volume Docker `pgdata`, non sul disco del computer.

Al **primo avvio**, quando il volume è vuoto, PostgreSQL esegue in automatico:

1. `db/schema.sql`: crea le tabelle
2. `db/seed.sql`: inserisce i dati di test

Agli avvii successivi gli script non vengono rieseguiti e i dati restano quelli del volume.

### 2. API

```bash
cd api
cp .env.example .env     # solo la prima volta, poi controlla i valori
npm install
npm run dev
```

Nel file `.env` imposta `JWT_SECRET` con una stringa casuale di almeno 32 caratteri,
altrimenti il server non parte. Per generarla:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

L'API risponde su http://localhost:3000. Per verificare la connessione al database:

```bash
curl http://localhost:3000/api/salute
```

## Test dell'API con REST Client

Per provare l'API direttamente da VS Code si usa l'estensione **REST Client**.

### Installazione

1. In VS Code apri il pannello Estensioni (`Cmd+Shift+X` su macOS, `Ctrl+Shift+X` su Windows/Linux).
2. Cerca **REST Client** (autore Huachao Mao) e clicca **Installa**.

In alternativa, da terminale:

```bash
code --install-extension humao.rest-client
```

### Creare un file `.http`

Le richieste si scrivono in file con estensione `.http`, che vanno nella cartella `api/mock/`.
Esiste già [`api/mock/mock.http`](api/mock/mock.http) con il test di health.

Regole di base:

- `@nome = valore` definisce una variabile, che si usa poi con `{{nome}}`;
- `###` separa una richiesta dalla successiva;
- le righe che iniziano con `#` sono commenti;
- la prima riga di ogni richiesta è `METODO URL`, seguita dalle intestazioni;
- il corpo va dopo **una riga vuota**.

Esempio:

```http
@baseUrl = http://localhost:3000/api

### Health check
GET {{baseUrl}}/salute
Accept: application/json

### Login (il corpo JSON va dopo una riga vuota)
# @name login
POST {{baseUrl}}/utenti/login
Content-Type: application/json

{
  "email": "mario.rossi@azienda.example",
  "password": "Password123!"
}

### Richiesta autenticata: riusa il token restituito dal login
GET {{baseUrl}}/richieste
Authorization: Bearer {{login.response.body.token}}
```

Sopra ogni richiesta compare il link **Send Request**: cliccalo e la risposta si apre in un pannello a destra.
Con `# @name login` si dà un nome alla richiesta, così le richieste successive possono leggerne la risposta,
per esempio il token con `{{login.response.body.token}}`.

> `/api/richieste` è ancora da implementare: l'esempio mostra come usare il token restituito dal login.

## Comandi utili

| Comando                                | Effetto                                                        |
|----------------------------------------|----------------------------------------------------------------|
| `docker compose up -d`                 | avvia PostgreSQL e pgAdmin                                     |
| `docker compose down`                  | ferma i servizi, i dati restano nel volume                     |
| `docker compose down -v`               | ferma i servizi e **cancella i dati**                          |
| `docker compose down -v && docker compose up -d` | ricrea il database da zero con schema e seed          |
| `docker compose logs -f postgres`      | mostra i log di PostgreSQL                                     |
| `docker compose exec postgres psql -U utente_app -d permessi` | apre una console SQL sul database      |

## Modello dei dati

| Tabella              | Contenuto                                                                    |
|----------------------|------------------------------------------------------------------------------|
| `utenti`             | nome, cognome, email (unica, senza distinguere maiuscole), hash bcrypt della password, ruolo `Dipendente` o `Responsabile` |
| `categorie_permesso` | tipi di permesso (Ferie, Visita medica, ...)                                 |
| `richieste_permesso` | date di inizio e fine, categoria, motivazione, stato `In attesa` / `Approvato` / `Rifiutato`, richiedente, data e autore della valutazione |

Il database fa rispettare alcune regole anche se l'API sbagliasse:

- la data di fine non può precedere la data di inizio;
- una richiesta in attesa non ha data di valutazione né responsabile;
- una richiesta approvata o rifiutata ha sempre una data di valutazione.

## Dati di test

Tutti gli utenti hanno la password **`Password123!`**.

| Utente                          | Ruolo        | Note                                 |
|---------------------------------|--------------|--------------------------------------|
| laura.bianchi@azienda.example   | Responsabile |                                      |
| marco.ferri@azienda.example     | Responsabile |                                      |
| mario.rossi@azienda.example     | Dipendente   | ha una richiesta a cavallo tra ottobre e novembre |
| giulia.verdi@azienda.example    | Dipendente   |                                      |
| luca.esposito@azienda.example   | Dipendente   |                                      |
| sara.colombo@azienda.example    | Dipendente   |                                      |
| paolo.ricci@azienda.example     | Dipendente   |                                      |
| elena.marino@azienda.example    | Dipendente   | nessuna richiesta (elenco vuoto)     |

Le 19 richieste vanno da settembre a dicembre 2026: 11 approvate, 5 in attesa e 3 rifiutate.
Ogni dipendente con richieste ne ha almeno una in attesa, quindi modificabile o eliminabile.

## Stato del progetto

- [x] Ambiente Docker con PostgreSQL e pgAdmin
- [x] Schema del database e dati di test
- [x] Registrazione (`POST /api/utenti/register`) e login con token JWT (`POST /api/utenti/login`)
- [x] Middleware `autentica` che verifica il token JWT, usato da `GET /api/utenti/me`
- [x] Middleware `richiediRuolo` / `soloResponsabili` per le rotte riservate ai responsabili (ancora da applicare alle rotte)
- [ ] API delle richieste e delle categorie: `api/server.js` contiene ancora anche le rotte di esempio del playground
- [ ] Strumento per il test dell'API: `api/mock/mock.http` con REST Client (health, registrazione, login, utente collegato, esempio hash)
- [ ] Frontend
- [ ] Statistiche per i responsabili (requisito avanzato)
- [ ] Deployment
