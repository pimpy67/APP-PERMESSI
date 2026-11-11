# Perché ogni endpoint ha quel ruolo e quei codici

Questa guida spiega le scelte della tabella in [`endpoint.md`](endpoint.md), così da saperle motivare all'esame.

## 1. Come si sceglie il codice di errore

Il server fa i controlli **sempre in questo ordine**, e il primo che fallisce decide il codice:

| Ordine | Domanda che si fa il server | Se la risposta è no |
|--------|-----------------------------|---------------------|
| 1 | Sei autenticato? (token presente e valido) | `401 Unauthorized` |
| 2 | Il tuo ruolo può usare questa rotta? | `403 Forbidden` |
| 3 | I dati che mi mandi sono validi? | `400 Bad Request` |
| 4 | La risorsa esiste? | `404 Not Found` |
| 5 | È tua? (per il dipendente) | `403 Forbidden` |
| 6 | È nello stato giusto? (es. "In attesa") | `409 Conflict` |
| – | Tutto ok | `200`, `201` o `204` |

**Come ricordarli:**

- **401**: "non so chi sei" → rifai il login.
- **403**: "so chi sei, ma non puoi" → rifare il login non cambia niente.
- **400**: "mi hai mandato dati sbagliati" → è colpa del client, deve correggere la richiesta.
- **404**: "non esiste".
- **409**: "la richiesta è corretta, ma va in conflitto con lo stato attuale dei dati" (email già usata, richiesta già approvata).

**I codici di successo:**

- **200 OK**: risposta con dati (lettura, modifica, approvazione).
- **201 Created**: hai creato qualcosa (registrazione, nuova richiesta). Si restituisce la risorsa creata.
- **204 No Content**: operazione riuscita ma non c'è niente da restituire (eliminazione).

## 2. Endpoint per endpoint

### `POST /api/utenti/register`
- **Ruolo:** nessuno, è aperta. Chi si registra non ha ancora un account, quindi non può avere un token.
- **201:** viene creato un utente.
- **400:** campi mancanti, vuoti, troppo lunghi (le colonne sono `VARCHAR(50)` e `VARCHAR(100)`), email senza `@`, password corta.
- **409:** l'email ha il vincolo `UNIQUE`. PostgreSQL dà l'errore `23505`, che il server traduce in 409.
- **Perché il ruolo non arriva dal client:** altrimenti chiunque potrebbe registrarsi come `Responsabile` e approvarsi i permessi da solo.

### `POST /api/utenti/login`
- **Ruolo:** nessuno, è aperta. È proprio la rotta che fornisce il token.
- **200:** restituisce il token, che il client manderà in tutte le richieste successive.
- **400:** email o password mancanti.
- **401:** credenziali sbagliate. Il messaggio è **lo stesso** sia se l'email non esiste sia se la password è errata, così chi attacca non scopre quali email sono registrate.

### `GET /api/utenti/me`
- **Ruolo:** tutti gli autenticati. Ognuno vede solo sé stesso, perché l'id viene dal token e non dall'URL.
- **401:** token mancante, scaduto o non valido.

### `GET /api/categorie`
- **Ruolo:** tutti gli autenticati. La traccia dice che *solo gli utenti autenticati possono accedere all'applicazione*. Al dipendente le categorie servono per compilare il form.
- **200:** elenco, anche vuoto (un elenco vuoto non è un errore).

### `GET /api/richieste`
- **Ruolo:** tutti, ma con dati diversi. Il dipendente vede le proprie (`WHERE utente_id = $1`, con l'id preso **dal token**), il responsabile tutte. Fonte: *"i dipendenti possono vedere solo le richieste personali, i responsabili quelle di tutti"*.
- **200:** elenco, anche vuoto. Elena Marino nei dati di test non ha richieste e riceve `[]`.
- **Perché non 403 per il dipendente:** la rotta gli è permessa, cambia solo il filtro.

### `GET /api/richieste/da-approvare`
- **Ruolo:** solo responsabile (`soloResponsabili`). È la lista di lavoro di chi approva.
- **403:** un dipendente che la chiama.
- **Perché è dichiarata prima di `/:id`:** Express controlla le rotte in ordine e prenderebbe "da-approvare" come se fosse un id.

### `GET /api/richieste/:id`
- **Ruolo:** tutti. Il dipendente solo se la richiesta è sua.
- **400:** l'id non è un numero intero positivo (es. `/api/richieste/abc`).
- **404:** nessuna riga con quell'id.
- **403:** la richiesta esiste ma appartiene a un altro dipendente.
- **Alternativa accettabile:** rispondere 404 anche quando non è sua, per non far sapere che quell'id esiste. È più sicuro, ma 403 è più chiaro da spiegare. L'importante è motivare la scelta.

### `POST /api/richieste`
- **Ruolo:** solo dipendente. La traccia dice *"inserimento nuova richiesta da parte del dipendente"*.
- **201:** richiesta creata con stato `In attesa` (è il default della colonna).
- **400:** date non valide, `data_fine` prima di `data_inizio`, categoria inesistente, motivazione vuota.
- **403:** un responsabile che prova a crearla.
- **Cosa il server NON prende dal client:** `utente_id` (si usa quello del token, altrimenti potresti creare richieste a nome di altri), `stato` (altrimenti potresti crearla già `Approvato`), `data_valutazione` e `utente_valutazione_id`.
- **Nota:** il vincolo `CHECK (data_fine >= data_inizio)` nel database c'è comunque, ma il server controlla prima per dare un messaggio chiaro con 400 invece di un 500.

### `PUT /api/richieste/:id`
- **Ruolo:** solo il dipendente proprietario. La traccia dice *"solo se propria e da approvare"*.
- **200:** richiesta modificata.
- **400:** dati non validi, come nella `POST`.
- **404:** non esiste.
- **403:** non è sua, oppure chi chiama è un responsabile.
- **409:** è già `Approvato` o `Rifiutato`. I dati sono corretti, ma lo **stato** della richiesta non permette la modifica: è proprio il caso del "conflitto".

### `DELETE /api/richieste/:id`
- **Ruolo:**
  - il dipendente elimina solo le proprie richieste ancora `In attesa`;
  - il responsabile può eliminare tutte le richieste, anche quelle approvate. Fonte: *"Solo gli utenti con ruolo Responsabile possono cancellare richieste già approvate"*.
- **204:** eliminata, nessun corpo nella risposta.
- **404:** non esiste.
- **403:** il dipendente prova a eliminare una richiesta non sua, oppure una sua già valutata. Qui si usa 403 e non 409 perché a un responsabile la stessa operazione sarebbe permessa: è una questione di **permessi**, non di stato.

### `PUT /api/richieste/:id/approva` e `/rifiuta`
- **Ruolo:** solo responsabile. Fonte: *"Solo gli utenti con ruolo Responsabile possono approvare o rifiutare richieste"*.
- **200:** restituisce la richiesta aggiornata.
- **403:** un dipendente. Senza questo controllo un dipendente potrebbe approvarsi da solo.
- **404:** non esiste.
- **409:** è già stata valutata. Non si approva due volte e non si cambia idea: la richiesta è "chiusa".
- **Cosa imposta il server:** `stato`, `data_valutazione = now()` e `utente_valutazione_id` = id del responsabile **dal token**. Il vincolo `CHECK` della tabella obbliga ad avere `data_valutazione` quando lo stato non è "In attesa".
- **Perché PUT e non POST:** si modifica una risorsa che esiste già.

### `GET /api/statistiche`
- **Ruolo:** solo responsabile. Fonte: *"L'endpoint deve essere accessibile solo dai responsabili"*.
- **400:** `mese` non nel formato `AAAA-MM` o `utente_id` non numerico.
- **200:** elenco, anche vuoto se con quei filtri non ci sono permessi approvati.
- **Perché i filtri sono in query string:** sono facoltativi e servono a filtrare una lettura (`?mese=2026-10`), non identificano una risorsa.

## 3. Domande tipiche all'esame

- **Che differenza c'è tra 401 e 403?** 401 = non autenticato, 403 = autenticato ma senza permesso.
- **Perché l'id dell'utente lo prendi dal token e non dal corpo?** Perché il corpo lo decide il client e potrebbe mentire. Il token è firmato dal server e non si può modificare.
- **Perché validi lato server se c'è già il form nel frontend?** Perché chiunque può chiamare l'API direttamente (come fai tu con REST Client) e saltare il frontend.
- **Perché query con `$1` e non concatenando le stringhe?** Per evitare la SQL injection: il valore viaggia separato dal testo SQL.
- **Perché 409 e non 400 quando la richiesta è già approvata?** I dati inviati sono corretti: è lo stato della risorsa sul server che impedisce l'operazione.
