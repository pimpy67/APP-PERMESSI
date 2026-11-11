# Come implementare gli endpoint, passo per passo

Le tabelle del database esistono già: le crea `db/schema.sql` al primo `docker compose up -d`.
Ora bisogna scrivere ogni rotta in `api/server.js` e collegarla alla sua query.
L'elenco completo degli endpoint è in [`endpoint.md`](endpoint.md).

## Lo schema di ogni endpoint

Ogni rotta segue sempre gli stessi 5 passi:

1. `app.metodo('/percorso', autentica, [soloResponsabili], async (req, res) => { ... })`
2. leggi e valida l'input (`req.params`, `req.query`, `req.body`): se è sbagliato rispondi `400`
3. esegui la query parametrizzata con `pool.query(sql, [valori])`
4. controlla il risultato: riga non trovata → `404`, non è tua → `403`, ...
5. rispondi con `res.status(...).json(...)`

Dopo ogni rotta aggiungi la richiesta in `api/mock/mock.http` e provala con REST Client.

## Da dove iniziare: `GET /api/categorie`

È la più semplice: niente input e una sola query.
Va in `server.js` dopo `/api/utenti/me`, nella sezione "Rotte autenticate":

```js
app.get('/api/categorie', autentica, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT categoria_id, descrizione FROM categorie_permesso ORDER BY descrizione'
  );
  res.json(rows.map(c => ({ id: c.categoria_id, descrizione: c.descrizione })));
});
```

Poi in `mock.http` (prima esegui il login):

```http
### Elenco categorie
GET {{baseUrl}}/categorie
Authorization: Bearer {{token}}
Accept: application/json
```

Quando funziona, hai il modello da copiare per tutte le altre rotte.

## Ordine consigliato e query di ciascun endpoint

| Passo | Endpoint | Query principale |
|-------|----------|------------------|
| 1 | `GET /api/categorie` | `SELECT categoria_id, descrizione FROM categorie_permesso` |
| 2 | `GET /api/richieste` | `SELECT ... FROM richieste_permesso r JOIN categorie_permesso c ... JOIN utenti u ...`; il dipendente aggiunge `WHERE r.utente_id = $1`, il responsabile vede tutto |
| 3 | `GET /api/richieste/da-approvare` | stessa query con `WHERE r.stato = 'In attesa'`, più `soloResponsabili` |
| 4 | `GET /api/richieste/:id` | stessa query con `WHERE r.richiesta_id = $1`; il dipendente riceve `403` se `utente_id` non è il suo |
| 5 | `POST /api/richieste` | `INSERT INTO richieste_permesso (data_inizio, data_fine, categoria_id, motivazione, utente_id) VALUES ($1, $2, $3, $4, $5) RETURNING ...` |
| 6 | `PUT /api/richieste/:id` | prima una `SELECT` per controllare proprietario e stato, poi `UPDATE ... SET data_inizio = $1, ... WHERE richiesta_id = $5` |
| 7 | `DELETE /api/richieste/:id` | `SELECT` per i controlli, poi `DELETE FROM richieste_permesso WHERE richiesta_id = $1` |
| 8 | `PUT /api/richieste/:id/approva` | `UPDATE ... SET stato = 'Approvato', data_valutazione = now(), utente_valutazione_id = $1 WHERE richiesta_id = $2 AND stato = 'In attesa'` |
| 9 | `PUT /api/richieste/:id/rifiuta` | come il passo 8, con `'Rifiutato'` |
| 10 | `GET /api/statistiche` | `SUM(data_fine - data_inizio + 1)` con `GROUP BY` utente e mese, solo per le richieste `Approvato` |

## Due regole da ricordare

- `/api/richieste/da-approvare` va dichiarata **prima** di `/api/richieste/:id`, altrimenti Express legge "da-approvare" come un id.
- Query sempre con `$1, $2, ...`, mai concatenando stringhe: è la difesa dalla SQL injection.

Il passo 2 è il più importante: la sua `SELECT` con le `JOIN` si riusa nei passi 3 e 4.
