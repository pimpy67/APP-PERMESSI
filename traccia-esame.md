## Richiesta e approvazione di permessi lavorativi

### Obiettivo della prova

La prova è finalizzata a valutare la capacità dell'esaminando di progettare e sviluppare un'applicazione web full stack con autenticazione, gestione di dati relazionali, interazione tra frontend e backend tramite API REST.

### Requisiti generali

- L'applicazione deve essere sviluppata con **separazione tra backend e frontend**
- L'applicazione deve essere realizzata con **tecnologia client-side rendering (CSR)**
- L'esaminando deve preparare uno strumento per il **test dell'API** esposta dal backend (Swagger, Postman, Insomnia o altro)
- L'applicazione dev'essere **inizializzata con un set di dati realistici**, sufficienti per testare tutti i casi d'uso previsti
- Il codice deve essere **strutturato e documentato**

### Architettura dell'applicazione

#### Backend

- Un **database** (a scelta del candidato)
- Un **servizio** che espone un'**API REST** consumata dal frontend
- Le tecnologie per il backend (linguaggi, framework) sono a scelta del candidato

#### Frontend

- Il framework per il frontend è a scelta del candidato

#### Note per la valutazione

- Corretta implementazione dell'**autenticazione**
- Corretta gestione dei **casi d'uso**
- Uso corretto delle **API REST**
- Interfaccia utente **chiara e funzionale**
- **Organizzazione del codice** e aderenza alle **best practices**
- Il **deployment**, se effettuato, contribuisce all'attribuzione di punteggio aggiuntivo

### Descrizione del caso d'uso

I dipendenti di un'azienda possono richiedere permessi per ferie, visite mediche o altri motivi. I responsabili possono visualizzare e approvare o rifiutare le richieste. Ogni permesso ha una data di inizio, una data di fine, una motivazione e uno stato.

### Modello dei dati

Le informazioni che si vogliono gestire sono le seguenti.

- **Utente**
    - UtenteID (PK)
    - Nome
    - Cognome
    - Email
    - Password
    - Ruolo (Dipendente / Responsabile)
- **CategoriaPermesso**
    - CategoriaID (PK)
    - Descrizione
- **RichiestaPermesso**
    - RichiestaID (PK)
    - DataRichiesta
    - DataInizio
    - DataFine
    - CategoriaID (FK)
    - Motivazione (testo libero)
    - Stato (In attesa, Approvato, Rifiutato)
    - UtenteID (FK - richiedente)
    - DataValutazione (data di approvazione o data di rifiuto)
    - UtenteValutazioneID (FK - responsabile che ha approvato o rifiutato)

Il data model proposto è indicativo. Il candidato può integrarlo secondo necessità.

### Chiamate API da sviluppare

Alcune API prevedono l'autenticazione, altre sono aperte.

Per ogni metodo, prevedere lato server la validazione dei dati ricevuti.

Le regole di sicurezza possono essere descritte nella sezione dedicata oppure all'interno della descrizione delle singole API.

#### API di registrazione e autenticazione

- `POST /api/utenti/register`: registrazione nuovo utente (Nome, Cognome, Email, Password)
- `POST /api/utenti/login`: autenticazione utente (Email, Password; viene restituito un token)

#### API con autenticazione

- `GET /api/richieste`: visualizzazione richieste (i dipendenti possono vedere solo le richieste personali, i responsabili possono vedere quelle di tutti)
- `GET /api/richieste/{Id}`: visualizzazione richiesta singola
- `POST /api/richieste`: inserimento nuova richiesta da parte del dipendente
- `PUT /api/richieste/{Id}`: modifica richiesta da parte del dipendente (solo se propria e da approvare)
- `DELETE /api/richieste/{Id}`: eliminazione richiesta (solo se propria e da approvare)
- `GET /api/richieste/da-approvare`: elenco richieste da approvare (solo per responsabili)
- `PUT /api/richieste/{id}/approva`: approvazione richiesta (solo responsabili)
- `PUT /api/richieste/{id}/rifiuta`: rifiuto richiesta (solo responsabili)
- `GET /api/categorie`: elenco categorie disponibili

#### API senza autenticazione

Nessuna.

### Regole di sicurezza

- Solo gli utenti autenticati possono accedere all'applicazione.
- Gli utenti "Dipendente" possono vedere e gestire solo le proprie richieste di permesso.
- Solo gli utenti con ruolo "Responsabile" possono approvare o rifiutare richieste.
- Solo gli utenti con ruolo "Responsabile" possono cancellare richieste già approvate.

### Requisiti della UI

- Le pagine devono essere **accessibili da un menu**
- L'interfaccia deve essere **chiara, responsive e coerente nello stile**
- Tutte le pagine devono essere **facilmente navigabili**

### Pagine da sviluppare

- Login / Registrazione
- Dashboard dipendente con:
    - Form per inserire una nuova richiesta di permesso
    - Elenco richieste personali con stato
    - Modifica ed eliminazione di richieste personali (solo se non approvate)
- Dashboard responsabile con:
    - Elenco richieste in attesa di approvazione
    - Pulsanti per approvare/rifiutare una richiesta di permesso

### Requisito avanzato (contribuisce al 20% del punteggio)

Implementare un endpoint per la **visualizzazione aggregata** delle richieste di permesso approvate, con il numero totale di giorni di permesso richiesti e approvati per ciascun **dipendente** in un dato **mese**, con filtro opzionale per entrambi i campi. L'endpoint deve essere accessibile solo dai responsabili.

Implementare una pagina che consente di visualizzare queste statistiche sotto forma di tabella e/o in forma grafica, con eventuali filtri per dipendente e mese. Questa pagina deve essere visualizzabile solo dai responsabili.

## Deployment

L'applicazione va pubblicata su un server a propria scelta. L'URL di accesso deve contenere **nome e cognome dell'allievo**.

Esempio: `https://app-nome-cognome.nomehost.dominio`