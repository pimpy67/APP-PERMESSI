# Come funziona la query che inserisce le richieste di permesso

Nel file `db/seed.sql` c'è una query che inserisce nel database le 19 richieste di permesso di prova. A prima vista sembra complicata, ma è fatta di pezzi che conosci già: `INSERT`, `SELECT`, `JOIN`. Qui la smontiamo un pezzo alla volta.

Per seguire questa guida ti servono:

- `INSERT INTO ... VALUES`
- `SELECT ... FROM ... WHERE`
- `JOIN` tra due tabelle con chiave primaria e chiave esterna

---

## 1. Il problema da risolvere

La tabella `richieste_permesso` non contiene il nome del dipendente o della categoria, ma i loro **id** (chiavi esterne):

| colonna                 | cosa contiene                                       |
|-------------------------|-----------------------------------------------------|
| `utente_id`             | id del dipendente che fa la richiesta (→ `utenti`)  |
| `categoria_id`          | id della categoria (→ `categorie_permesso`)          |
| `utente_valutazione_id` | id del responsabile che l'ha valutata (→ `utenti`)  |

Gli id però li genera PostgreSQL, perché le colonne sono `GENERATED ALWAYS AS IDENTITY`. Chi scrive il seed non dovrebbe doverli conoscere a memoria. Scrivere

```sql
INSERT INTO richieste_permesso (utente_id, categoria_id, ...) VALUES (3, 1, ...);
```

funziona, ma solo se si sa che Mario Rossi ha l'id 3 e che "Ferie" ha l'id 1. È scomodo da leggere, e basta cambiare l'ordine degli utenti per sbagliare tutto.

**L'idea della query:** scriviamo le richieste usando cose che sappiamo e che sono uniche, cioè l'**email** dell'utente e la **descrizione** della categoria. Poi lasciamo che sia il database a trovare gli id con dei `JOIN`.

---

## 2. La query completa

Ecco la query, accorciata a 3 richieste. Le altre 16 sono uguali.

```sql
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
  ('mario.rossi@azienda.example',  'Ferie',      '2026-08-20 09:15', '2026-09-07', '2026-09-11', 'Vacanza estiva posticipata',  'Approvato', '2026-08-21 10:00', 'laura.bianchi@azienda.example'),
  ('mario.rossi@azienda.example',  'Ferie',      '2026-11-02 16:45', '2026-12-21', '2026-12-31', 'Vacanze di Natale',           'In attesa', NULL,               NULL),
  ('giulia.verdi@azienda.example', 'Formazione', '2026-09-01 10:00', '2026-09-24', '2026-09-25', 'Corso di aggiornamento',      'Approvato', '2026-09-02 12:00', 'marco.ferri@azienda.example')
) AS v(email, categoria, data_richiesta, data_inizio, data_fine,
       motivazione, stato, data_valutazione, email_responsabile)
JOIN utenti u             ON u.email = v.email
JOIN categorie_permesso c ON c.descrizione = v.categoria
LEFT JOIN utenti r        ON r.email = v.email_responsabile;
```

La query ha due parti:

1. **`INSERT INTO richieste_permesso (...)`**: dove inserire;
2. **tutto il resto, da `SELECT` in poi**: una normale `SELECT` che calcola le righe da inserire.

Conviene leggerla **dal basso verso l'alto**, nell'ordine in cui il database la esegue: prima `FROM` e `JOIN`, poi `SELECT`, infine `INSERT`.

---

## 3. Passo 1: `VALUES` come tabella

```sql
FROM (VALUES
  ('mario.rossi@azienda.example', 'Ferie', ...),
  ...
) AS v(email, categoria, data_richiesta, data_inizio, data_fine,
       motivazione, stato, data_valutazione, email_responsabile)
```

Di solito `VALUES` lo usi dentro una `INSERT`. Qui invece è dentro un `FROM`, cioè **al posto di una tabella**. Così si crea una tabella "al volo", che esiste solo durante questa query e non viene salvata da nessuna parte.

- Ogni riga tra parentesi è una richiesta.
- `AS v(...)` dà alla tabella il nome **`v`** (come "valori") e dà un nome a ogni colonna, nell'ordine.

Il risultato è questa tabella `v` (alcune colonne sono omesse):

| email                        | categoria  | data_inizio | stato     | email_responsabile            |
|------------------------------|------------|-------------|-----------|-------------------------------|
| mario.rossi@azienda.example  | Ferie      | 2026-09-07  | Approvato | laura.bianchi@azienda.example |
| mario.rossi@azienda.example  | Ferie      | 2026-12-21  | In attesa | NULL                          |
| giulia.verdi@azienda.example | Formazione | 2026-09-24  | Approvato | marco.ferri@azienda.example   |

Da qui in poi puoi pensare a `v` come a una tabella qualsiasi.

> **Nota:** nella motivazione `'Matrimonio di un amico all''estero'` ci sono due apostrofi di fila. In SQL le stringhe sono racchiuse tra apostrofi, quindi per scrivere un apostrofo *dentro* una stringa lo si raddoppia.

---

## 4. Passo 2: trovare l'id del dipendente

```sql
JOIN utenti u ON u.email = v.email
```

È un `JOIN` normale tra la tabella `v` e la tabella `utenti`, alla quale diamo l'alias **`u`**. Ogni riga di `v` viene unita all'utente che ha **la stessa email**.

Dopo questo `JOIN` ogni riga ha anche le colonne di `utenti`, e in particolare `u.utente_id`:

| v.email                      | v.categoria | … | u.utente_id | u.nome |
|------------------------------|-------------|---|-------------|--------|
| mario.rossi@azienda.example  | Ferie       | … | 3           | Mario  |
| mario.rossi@azienda.example  | Ferie       | … | 3           | Mario  |
| giulia.verdi@azienda.example | Formazione  | … | 4           | Giulia |

**Abbiamo trasformato l'email nell'id del dipendente.** Il `JOIN` funziona perché l'email è `UNIQUE`: a ogni email corrisponde al massimo un utente.

---

## 5. Passo 3: trovare l'id della categoria

```sql
JOIN categorie_permesso c ON c.descrizione = v.categoria
```

È la stessa idea, con la tabella delle categorie (alias **`c`**): ogni riga viene unita alla categoria con la stessa descrizione. Anche `descrizione` è `UNIQUE`.

| v.email                      | v.categoria | … | u.utente_id | c.categoria_id |
|------------------------------|-------------|---|-------------|----------------|
| mario.rossi@azienda.example  | Ferie       | … | 3           | 1              |
| mario.rossi@azienda.example  | Ferie       | … | 3           | 1              |
| giulia.verdi@azienda.example | Formazione  | … | 4           | 5              |

---

## 6. Passo 4: trovare l'id del responsabile (e perché `LEFT JOIN`)

```sql
LEFT JOIN utenti r ON r.email = v.email_responsabile
```

Qui ci sono due novità.

### La stessa tabella usata due volte

Il responsabile è anche lui un utente, quindi dobbiamo cercarlo di nuovo nella tabella `utenti`. Però `u` è già occupato dal dipendente. Diamo allora alla stessa tabella un **secondo alias**, **`r`** come "responsabile".

`u` e `r` sono la stessa tabella `utenti`, usata con due ruoli diversi:

- `u` → l'utente che **chiede** il permesso (collegato tramite `v.email`);
- `r` → l'utente che **valuta** la richiesta (collegato tramite `v.email_responsabile`).

Senza alias diversi il database non saprebbe a quale dei due ti riferisci quando scrivi `utente_id`.

### Perché `LEFT JOIN` e non `JOIN`

Le richieste **"In attesa"** non sono ancora state valutate, quindi hanno `email_responsabile = NULL`.

Ricorda cosa fa un `JOIN` normale (inner join): tiene **solo le righe che trovano una corrispondenza** nell'altra tabella. `NULL` non è uguale a nessuna email, perché un confronto con `NULL` non è mai vero. Con un `JOIN` normale le richieste in attesa **sparirebbero** dal risultato e non verrebbero inserite.

Il `LEFT JOIN` invece **tiene tutte le righe della tabella di sinistra** (quella che viene prima, qui il risultato dei passi precedenti). Se non trova una corrispondenza, riempie le colonne di `r` con `NULL`.

| v.motivazione              | v.stato   | u.utente_id | c.categoria_id | r.utente_id |
|----------------------------|-----------|-------------|----------------|-------------|
| Vacanza estiva posticipata | Approvato | 3           | 1              | 1           |
| Vacanze di Natale          | In attesa | 3           | 1              | **NULL**    |
| Corso di aggiornamento     | Approvato | 4           | 5              | 2           |

La richiesta "Vacanze di Natale" c'è ancora, con `r.utente_id = NULL`. È proprio quello che vogliamo: una richiesta in attesa non ha un responsabile che l'abbia valutata.

| tipo di join | cosa succede alle richieste "In attesa"           |
|--------------|---------------------------------------------------|
| `JOIN`       | scompaiono: verrebbero inserite solo 14 richieste |
| `LEFT JOIN`  | restano, con `r.utente_id = NULL`: 19 richieste   |

---

## 7. Passo 5: la `SELECT` sceglie le colonne

```sql
SELECT u.utente_id,
       c.categoria_id,
       v.data_richiesta::timestamptz,
       v.data_inizio::date,
       v.data_fine::date,
       v.motivazione,
       v.stato,
       v.data_valutazione::timestamptz,
       r.utente_id
```

Dopo i `JOIN` abbiamo una tabella con tante colonne. La `SELECT` prende solo quelle che ci servono:

- gli **id** arrivano dalle tabelle collegate: `u.utente_id`, `c.categoria_id`, `r.utente_id`;
- gli **altri dati** arrivano direttamente da `v`.

### Cosa vuol dire `::date` e `::timestamptz`

Dentro `VALUES` le date sono scritte tra apostrofi, quindi per il database sono **stringhe di testo**. Il simbolo `::` è il modo abbreviato di PostgreSQL per **convertire un valore in un altro tipo** (cast):

```sql
'2026-09-07'::date               -- la stringa diventa una data
'2026-08-20 09:15'::timestamptz  -- la stringa diventa data + ora
```

È la stessa cosa che scrivere, in SQL standard:

```sql
CAST('2026-09-07' AS date)
```

Serve perché le colonne di `richieste_permesso` sono di tipo `DATE` e `TIMESTAMPTZ`, e il valore deve avere il tipo giusto.

---

## 8. Passo 6: la `INSERT` inserisce il risultato

```sql
INSERT INTO richieste_permesso
  (utente_id, categoria_id, data_richiesta, data_inizio, data_fine,
   motivazione, stato, data_valutazione, utente_valutazione_id)
SELECT ...
```

Questa forma si chiama **`INSERT ... SELECT`**: al posto di `VALUES` con i dati scritti a mano, la `INSERT` riceve **le righe prodotte da una `SELECT`**. Ogni riga del risultato diventa una nuova riga in `richieste_permesso`.

Le colonne della `SELECT` vengono abbinate a quelle elencate nella `INSERT` **per posizione**, non per nome:

| posizione | colonna della `INSERT`  | valore dalla `SELECT`           |
|-----------|-------------------------|---------------------------------|
| 1         | `utente_id`             | `u.utente_id`                   |
| 2         | `categoria_id`          | `c.categoria_id`                |
| 3         | `data_richiesta`        | `v.data_richiesta::timestamptz` |
| 4         | `data_inizio`           | `v.data_inizio::date`           |
| 5         | `data_fine`             | `v.data_fine::date`             |
| 6         | `motivazione`           | `v.motivazione`                 |
| 7         | `stato`                 | `v.stato`                       |
| 8         | `data_valutazione`      | `v.data_valutazione::timestamptz` |
| 9         | `utente_valutazione_id` | `r.utente_id`                   |

Se scambi l'ordine di due colonne nella `SELECT`, i dati finiscono nella colonna sbagliata.

Nella lista manca `richiesta_id`: è una colonna `IDENTITY`, quindi il suo valore lo genera PostgreSQL. Anche `data_richiesta` avrebbe un valore automatico (`DEFAULT now()`, cioè il momento dell'inserimento), ma qui la scriviamo noi, per avere date realistiche nei dati di prova.

---

## 9. Riepilogo

```
  tabella v (VALUES)          email, categoria, date, motivazione, stato, email responsabile
        │
        ├── JOIN utenti u               email          → u.utente_id     (chi chiede)
        ├── JOIN categorie_permesso c   descrizione    → c.categoria_id
        └── LEFT JOIN utenti r          email resp.    → r.utente_id     (chi valuta, o NULL)
        │
  SELECT        sceglie le 9 colonne e converte le date
        │
  INSERT INTO   inserisce ogni riga in richieste_permesso
```

In una frase: **scriviamo le richieste con email e nomi leggibili, i `JOIN` li trasformano negli id, e la `INSERT` salva il risultato.**

---

## 10. Provalo tu

Il modo migliore per capire una `INSERT ... SELECT` è **eseguire solo la `SELECT`**: vedi le righe che verrebbero inserite, senza inserire niente.

1. Apri pgAdmin (http://localhost:5050) e poi il Query Tool sul database `permessi`.
2. Copia la query da `db/seed.sql` **senza le prime tre righe** (`INSERT INTO ...` e l'elenco delle colonne), così parte da `SELECT`.
3. Eseguila: vedrai 19 righe con gli id già calcolati.

Poi prova a modificarla:

- **Cambia `LEFT JOIN` in `JOIN`.** Quante righe ottieni? Quali richieste mancano, e perché?
- **Aggiungi `u.nome, r.nome` alla `SELECT`.** Vedrai il nome del dipendente e quello del responsabile sulla stessa riga: la prova che `u` e `r` sono la stessa tabella usata due volte.
- **Scrivi in una riga di `VALUES` un'email che non esiste.** Cosa succede a quella riga? (Suggerimento: rileggi il passo 2.)
- **Togli `::date` da `v.data_inizio`** ed esegui solo la `SELECT`. Funziona lo stesso? Che tipo ha ora la colonna? Se poi provassi la `INSERT` completa, PostgreSQL la accetterebbe?
