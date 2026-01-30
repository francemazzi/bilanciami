# Bilanciami

Sistema di estrazione e gestione fatture basato su intelligenza artificiale. Estrae automaticamente dati strutturati da fatture italiane e altri documenti fiscali utilizzando elaborazione di testo e visione avanzata.

## Caratteristiche

- **Estrazione AI a doppio canale**: Pipeline parallela di estrazione testo e visione con riconciliazione automatica
- **Supporto documenti italiani**: Fatture Elettroniche (TD01, TD24), DDT, fatture pro-forma
- **Gestione documenti**: Archiviazione, visualizzazione e organizzazione dei documenti estratti
- **Multi-utente**: Autenticazione sicura con JWT e associazioni utente-documento
- **API REST**: Documentazione Swagger/OpenAPI completa
- **Containerizzato**: Deploy con Docker Compose pronto per la produzione

## Tecnologie

### Frontend
- React 19 + TypeScript
- Vite
- TailwindCSS + Radix UI
- Zustand + TanStack Query

### Backend
- Fastify + TypeScript
- Prisma ORM + PostgreSQL
- LangChain + LangGraph
- OpenAI API

### Infrastruttura
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7
- Nginx

## Installazione Rapida

### Prerequisiti
- Docker e Docker Compose
- Chiave API OpenAI

### Avvio con Docker (consigliato)

```bash
# macOS/Linux
./start.sh

# Windows
start.bat
```

I servizi saranno disponibili su:
- Frontend: http://localhost
- API: http://localhost:8372
- Documentazione API: http://localhost:8372/docs

### Aggiornamento

```bash
# macOS/Linux
./update.sh

# Windows
update.bat
```

## Sviluppo Locale

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Il frontend di sviluppo sarà disponibile su http://localhost:5173

## Configurazione

Crea un file `.env` nella root del progetto (vedi `.env.example`):

```env
# Chiave di crittografia per dati sensibili (generata automaticamente)
ENCRYPTION_KEY=your_32_byte_hex_key

# Database
DATABASE_URL=postgresql://bilanciami:bilanciami@postgres:5432/bilanciami

# Redis
REDIS_URL=redis://redis:6379
```

La chiave API OpenAI può essere configurata:
- Globalmente tramite variabile d'ambiente `OPENAI_API_KEY`
- Per utente nelle impostazioni dell'applicazione

## Struttura del Progetto

```
bilanciami/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Componenti pagina
│   │   ├── components/    # Componenti riutilizzabili
│   │   ├── api/           # Client API
│   │   └── stores/        # Store Zustand
│   └── Dockerfile
│
├── server/                 # Backend Fastify
│   ├── src/
│   │   ├── agents/        # Agenti AI LangGraph
│   │   ├── routes/        # Handler API
│   │   ├── services/      # Logica di business
│   │   └── middleware/    # Middleware Fastify
│   ├── prisma/            # Schema database
│   └── Dockerfile
│
├── docker-compose.yml      # Orchestrazione container
├── start.sh / start.bat    # Script di avvio
└── update.sh / update.bat  # Script di aggiornamento
```

## API Endpoints

### Autenticazione
- `POST /api/v1/auth/register` - Registrazione utente
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Utente corrente

### Estrazione Fatture
- `POST /api/v1/invoices/extract` - Estrai dati da PDF (multipart)
- `GET /api/v1/invoices/schema` - Schema dati fattura

### Documenti
- `GET /api/v1/documents` - Lista documenti utente
- `GET /api/v1/documents/:id` - Dettaglio documento
- `POST /api/v1/documents` - Crea documento
- `PUT /api/v1/documents/:id` - Aggiorna documento
- `DELETE /api/v1/documents/:id` - Elimina documento

## Dati Estratti

Il sistema estrae automaticamente:
- ID fattura e tipo documento
- Dati fornitore/cliente (P.IVA, ragione sociale, indirizzo)
- Righe articoli (codice, quantità, prezzo unitario, IVA)
- Riepilogo IVA e imposte
- Totali (imponibile, IVA, totale documento)
- Dettagli pagamento e condizioni

## Script Disponibili

### Backend
- `npm run dev` - Avvio in modalità sviluppo
- `npm start` - Avvio produzione
- `npm run build` - Compilazione TypeScript
- `npm test` - Esegui test

### Frontend
- `npm run dev` - Server sviluppo Vite
- `npm run build` - Build produzione
- `npm run lint` - Controllo ESLint

## Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi il file [LICENSE](LICENSE) per i dettagli.
