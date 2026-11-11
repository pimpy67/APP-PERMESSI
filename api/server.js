/*
 * Playground API: esercizi con le query e il driver pg.
 *
 * Tabella necessaria (eseguila nel database permessi):
 *
 *   CREATE TABLE utenti (
 *       id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *       email          VARCHAR(100) NOT NULL UNIQUE,
 *       password_hash  VARCHAR(255) NOT NULL,
 *       attivo         BOOLEAN      NOT NULL DEFAULT TRUE
 *   );
 */

import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs'; // stessa API di 'bcrypt', ma in puro JavaScript: non richiede compilazione
import pg from 'pg';
import jwt from 'jsonwebtoken';

const { Pool } = pg;

const PORT = process.env.PORT ?? 3000;
const ESEMPI_VULNERABILI = process.env.ESEMPI_VULNERABILI === 'true';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL non è impostata. Copia .env.example in .env e compila i valori.');
  process.exit(1);
}

// Il segreto firma i token: senza, chiunque potrebbe crearne di validi.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET non è impostata o è troppo corta (minimo 32 caratteri). Vedi .env.example.');
  process.exit(1);
}

// Un solo pool per tutta l'applicazione.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();

// ---------------------------------------------------------------
// Middleware di log delle chiamate
// ---------------------------------------------------------------

// Scrive una riga per ogni chiamata, quando la risposta è stata inviata:
//   2026-11-08T15:30:12.345Z POST /api/utenti/login 200 241ms utente=-
//
// Per sicurezza registra solo il percorso, senza query string, corpo e header:
// lì possono esserci password (?testo=...), email o il token JWT (Authorization).
// È registrato prima di express.json(), così compaiono anche le chiamate
// con JSON non valido.
function logChiamate(req, res, next) {
  const inizio = process.hrtime.bigint();

  // 'finish' scatta quando la risposta è stata consegnata al client.
  // A quel punto conosciamo lo stato HTTP e, se la rotta era autenticata,
  // anche l'utente (req.utente viene impostato dal middleware autentica).
  res.on('finish', () => {
    const durataMs = Number(process.hrtime.bigint() - inizio) / 1e6;
    const percorso = req.originalUrl.split('?')[0];
    const utente = req.utente?.id ?? '-';

    console.log(
      `${new Date().toISOString()} ${req.method} ${percorso} ${res.statusCode} ${durataMs.toFixed(0)}ms utente=${utente}`
    );
  });

  next();
}

app.use(logChiamate);
app.use(express.json());

// ---------------------------------------------------------------
// Funzioni di hashing
// ---------------------------------------------------------------

// Solo per dimostrare come lavorano i digest. Non usarle per le password.
function hashSha256(testo) {
  return crypto.createHash('sha256').update(testo).digest('hex');
}

function hashMd5(testo) {
  return crypto.createHash('md5').update(testo).digest('hex');
}

// Il metodo corretto per le password: bcrypt con fattore di costo 12.
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verificaPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------
// Middleware di autenticazione
// ---------------------------------------------------------------

// Verifica il token JWT nell'header "Authorization: Bearer <token>".
// Se il token è valido, salva in req.utente l'id e il ruolo dell'utente
// e passa alla rotta. Altrimenti risponde 401 e la rotta non viene eseguita.
//
// Uso: app.get('/api/rotta-protetta', autentica, (req, res) => { ... req.utente ... });
function autentica(req, res, next) {
  const intestazione = req.get('Authorization') ?? '';
  const [schema, token] = intestazione.split(' ');

  if (schema !== 'Bearer' || !token) {
    // L'header WWW-Authenticate indica al client quale schema di autenticazione usare.
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ errore: 'Token mancante' });
  }

  try {
    // algorithms fissa l'algoritmo atteso: un token firmato in altro modo viene rifiutato.
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.utente = { id: Number(payload.sub), ruolo: payload.ruolo };
    next();
  } catch (err) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    const errore = err.name === 'TokenExpiredError' ? 'Token scaduto' : 'Token non valido';
    return res.status(401).json({ errore });
  }
}

// Controlla che l'utente autenticato abbia uno dei ruoli indicati.
// Va sempre usato DOPO autentica, che imposta req.utente.
//   401 Unauthorized: non sappiamo chi sei (token mancante o non valido)
//   403 Forbidden:    sappiamo chi sei, ma non hai il permesso
//
// Il ruolo viene letto dal token: se cambia nel database, vale dal login successivo.
//
// Uso: app.put('/api/richieste/:id/approva', autentica, richiediRuolo('Responsabile'), ...)
function richiediRuolo(...ruoliAmmessi) {
  return (req, res, next) => {
    if (!req.utente) {
      // Succede solo se ci si dimentica di mettere autentica prima di richiediRuolo.
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ errore: 'Token mancante' });
    }
    if (!ruoliAmmessi.includes(req.utente.ruolo)) {
      return res.status(403).json({ errore: 'Operazione non consentita per il tuo ruolo' });
    }
    next();
  };
}

// Scorciatoia per le rotte riservate ai responsabili.
const soloResponsabili = richiediRuolo('Responsabile');

// ---------------------------------------------------------------
// Rotte di esempio, già pronte
// ---------------------------------------------------------------

app.get('/api/salute', async (req, res) => {
  const { rows } = await pool.query('SELECT 1 AS ok');
  res.json({ database: rows[0].ok === 1 ? 'raggiungibile' : 'anomalo' });
});

// Confronto tra digest (MD5, SHA-256) e bcrypt sullo stesso testo.
// MD5 e SHA-256 danno sempre lo stesso risultato; bcrypt genera un salt casuale
// a ogni chiamata, quindi l'hash cambia ogni volta pur verificando lo stesso testo.
app.get('/api/esempi/hash', async (req, res) => {
  const testo = req.query.testo ?? '';
  res.json({
    testo,
    md5: hashMd5(testo),
    sha256: hashSha256(testo),
    bcrypt: await hashPassword(testo),
  });
});

// Verifica di un hash bcrypt: { testo, hash } -> { valido }.
// Il salt e il fattore di costo sono scritti dentro l'hash ($2a$12$<salt><hash>),
// quindi bcrypt li rilegge, ricalcola l'hash del testo e confronta i risultati.
// Per questo due hash diversi della stessa password risultano entrambi validi.
// È una POST perché testo e hash non devono finire nell'URL (e quindi nei log del server).
const FORMATO_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

app.post('/api/esempi/hash/verifica', async (req, res) => {
  const { testo, hash } = req.body ?? {};

  if (typeof testo !== 'string' || typeof hash !== 'string') {
    return res.status(400).json({ errore: 'testo e hash sono obbligatori' });
  }
  if (!FORMATO_BCRYPT.test(hash)) {
    return res.status(400).json({ errore: 'hash non è nel formato bcrypt ($2a$12$...)' });
  }

  res.json({ valido: await verificaPassword(testo, hash) });
});

// Query parametrizzata: il valore viaggia separato dal testo SQL.
app.get('/api/esempi/ricerca-sicura', async (req, res) => {
  const email = req.query.email ?? '';
  const { rows } = await pool.query(
    'SELECT id, email, attivo FROM utenti WHERE email = $1',
    [email]
  );
  res.json(rows);
});

// Query concatenata: vulnerabile a SQL injection.
// Attiva solo se ESEMPI_VULNERABILI=true nel file .env, e solo in locale.
app.get('/api/esempi/ricerca-vulnerabile', async (req, res) => {
  if (!ESEMPI_VULNERABILI) {
    return res.status(404).json({ errore: 'Rotta non attiva' });
  }
  const email = req.query.email ?? '';
  const { rows } = await pool.query(
    `SELECT id, email, attivo FROM utenti WHERE email = '${email}'`
  );
  res.json(rows);
});

// ---------------------------------------------------------------
// Rotte autenticate
// ---------------------------------------------------------------

// GET /api/utenti/me: dati dell'utente a cui appartiene il token.
// Serve al frontend per sapere chi è collegato (ad esempio dopo un ricaricamento
// della pagina) e per verificare che il token sia ancora valido.
// Va dichiarata prima di /api/utenti/:id, altrimenti Express tratta "me" come un id.
app.get('/api/utenti/me', autentica, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT utente_id, nome, cognome, email, ruolo FROM utenti WHERE utente_id = $1',
    [req.utente.id]
  );
  const utente = rows[0];

  // Il token è valido ma l'utente nel frattempo è stato eliminato.
  if (!utente) {
    return res.status(401).json({ errore: 'Token non valido' });
  }

  res.json({
    id: utente.utente_id,
    nome: utente.nome,
    cognome: utente.cognome,
    email: utente.email,
    ruolo: utente.ruolo,
  });
});

// ---------------------------------------------------------------
// Esercizi: da completare
// ---------------------------------------------------------------

// ESERCIZIO 1: GET /api/utenti
// Restituisci tutti gli utenti con id, email e attivo.
// Non restituire mai password_hash.
app.get('/api/utenti', (req, res) => {
  res.status(501).json({ errore: 'Da implementare' });
});

// ESERCIZIO 2: GET /api/utenti/:id
// Restituisci un utente. Se non esiste, rispondi 404.
app.get('/api/utenti/:id', (req, res) => {
  res.status(501).json({ errore: 'Da implementare' });
});

// ESERCIZIO 3: POST /api/utenti/register
// Corpo: { nome, cognome, email, password }.
// Valida i campi, calcola l'hash con hashPassword e inserisci la riga.
// Il ruolo non arriva dal client: ogni nuovo utente è "Dipendente" (default della tabella).
// Se l'email esiste già (err.code === '23505'), rispondi 409.
// In caso di successo rispondi 201 con i dati dell'utente, senza hash.
app.post('/api/utenti/register', async (req, res) => {
  const { nome, cognome, email, password } = req.body ?? {};

  if (
    typeof nome !== 'string' ||
    typeof cognome !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({ errore: 'Nome, cognome, email e password sono obbligatori' });
  }

  const nomePulito = nome.trim();
  const cognomePulito = cognome.trim();

  if (nomePulito === '' || cognomePulito === '') {
    return res.status(400).json({ errore: 'Nome e cognome non possono essere vuoti' });
  }
  // Le colonne nome e cognome sono VARCHAR(50).
  if (nomePulito.length > 50 || cognomePulito.length > 50) {
    return res.status(400).json({ errore: 'Nome e cognome possono avere al massimo 50 caratteri' });
  }
  if (email.trim() === '' || !email.includes('@')) {
    return res.status(400).json({ errore: 'Email non valida' });
  }
  // La colonna email è VARCHAR(100): oltre questo limite PostgreSQL darebbe errore.
  if (email.length > 100) {
    return res.status(400).json({ errore: 'Email troppo lunga (massimo 100 caratteri)' });
  }
  if (password.length < 8) {
    return res.status(400).json({ errore: 'La password deve avere almeno 8 caratteri' });
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO utenti (nome, cognome, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING utente_id, nome, cognome, email, ruolo`,
      [nomePulito, cognomePulito, email, passwordHash]
    );
    const utente = rows[0];
    res.status(201).json({
      id: utente.utente_id,
      nome: utente.nome,
      cognome: utente.cognome,
      email: utente.email,
      ruolo: utente.ruolo,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ errore: 'Email già registrata' });
    }
    throw err; // gestito dal middleware centrale degli errori
  }
});

// ESERCIZIO 4: POST /api/utenti/login
// Corpo: { email, password }.
// Cerca l'utente con una query parametrizzata.
// Se l'email non esiste rispondi 401, altrimenti confronta con verificaPassword.
// Rispondi 200 con il token JWT e i dati dell'utente, oppure 401 con un messaggio generico.
app.post('/api/utenti/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ errore: 'Email e password sono obbligatorie' });
  }

  // lower() su entrambi i lati: l'email non distingue maiuscole e minuscole
  // e la query sfrutta l'indice utenti_email_lower_uq.
  const { rows } = await pool.query(
    'SELECT utente_id, email, ruolo, password_hash FROM utenti WHERE lower(email) = lower($1)',
    [email]
  );
  const utente = rows[0];

  if (!utente) {
    return res.status(401).json({ errore: 'Credenziali non valide' });
  }

  const passwordCorretta = await verificaPassword(password, utente.password_hash);
  if (!passwordCorretta) {
    return res.status(401).json({ errore: 'Credenziali non valide' });
  }

  // Il token contiene solo ciò che serve per autorizzare le richieste successive:
  // l'id dell'utente (sub) e il ruolo. Mai la password o l'hash.
  // Il payload di un JWT è leggibile da chiunque: la firma impedisce di modificarlo, non di leggerlo.
  const token = jwt.sign(
    { sub: String(utente.utente_id), ruolo: utente.ruolo },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );

  res.status(200).json({
    token,
    utente: { id: utente.utente_id, email: utente.email, ruolo: utente.ruolo },
  });
});

// ESERCIZIO 5 (bonus): GET /api/utenti/conteggio
// Restituisci il numero di utenti con COUNT(*).
// Dichiara questa rotta prima di /api/utenti/:id, altrimenti Express
// tratta la parola "conteggio" come un id.
app.get('/api/utenti/conteggio', (req, res) => {
  res.status(501).json({ errore: 'Da implementare' });
});

// ---------------------------------------------------------------
// Gestione degli errori
// ---------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ errore: 'Rotta non trovata' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ errore: 'JSON non valido' });
  }
  console.error(err);
  res.status(500).json({ errore: 'Errore interno del server' });
});

app.listen(PORT, () => {
  console.log(`Playground API su http://localhost:${PORT}`);
});
