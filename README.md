# Slutpris Analys - Booli & Hemnet

Ett verktyg för att analysera slutpriser från Booli och Hemnet, och beräkna genomsnittlig skillnad mellan utgångspris och slutpris.

## 📁 Projektstruktur

```
booli/
├── server.js              # Node.js server med API-proxies
├── index.html             # Huvudapp för Booli (automatisk datahämtning)
├── hemnet-viewer.html     # Viewer för Hemnet-data
├── hemnet-scraper.js      # DevTools-script för att hämta data från Hemnet
├── hemnet-data.json       # Sparad Hemnet-data (persisteras här)
├── HEMNET-INSTRUCTIONS.md # Detaljerade instruktioner för Hemnet
└── README.md             # Denna fil
```

## 🚀 Kom igång

### 1. Starta servern

```bash
node server.js
```

Servern körs på `http://localhost:3000`

### 2. Använd Booli (Automatisk)

1. Öppna `http://localhost:3000/` i din webbläsare
2. Välj "Booli" som datakälla
3. Ange Area ID (t.ex. 2030 för Sollentuna)
4. Välj objekttyp (Villa, Lägenhet, Tomt)
5. Klicka "Hämta data och beräkna"

✅ **Fungerar automatiskt!** Booli-data hämtas direkt via servern.

### 3. Använd Hemnet (Manuellt via DevTools)

**Första gången:**
1. Gå till [Hemnet](https://www.hemnet.se/salda/bostader?location_ids%5B%5D=17851&item_types%5B%5D=villa)
2. Öppna DevTools (`Cmd+Option+I`)
3. Kopiera och kör innehållet från `hemnet-scraper.js`
4. Kör: `copy(JSON.stringify(window.hemnetData, null, 2))`
5. Gå till `http://localhost:3000/hemnet-viewer.html`
6. Klistra in JSON-data
7. Klicka "Ladda & Spara data"

**Nästa gånger:**
1. Gå till `http://localhost:3000/hemnet-viewer.html`
2. Klicka "Ladda från fil"
3. Färdig! 🎉

Se [HEMNET-INSTRUCTIONS.md](HEMNET-INSTRUCTIONS.md) för detaljerade instruktioner.

## ⚠️ Varför fungerar inte Hemnet automatiskt?

Hemnet blockerar server-till-server förfrågningar (HTTP 403) som skydd mot automatisk datahämtning. Därför måste vi använda ett DevTools-script som körs direkt i webbläsaren där Hemnet ser det som en normal användarinteraktion.

## 📊 Funktioner

### Booli-appen (`index.html`)
- ✅ Automatisk datahämtning via proxy
- 📈 Beräknar genomsnittlig prisförändring
- 🔍 Filtrera på minimipris
- 📄 Paginering (hämta flera sidor)
- 🎨 Snyggt visuellt gränssnitt

### Hemnet-viewer (`hemnet-viewer.html`)
- 💾 Persistent lagring i `hemnet-data.json`
- 📥 Ladda sparad data med ett klick
- 📊 Samma statistik och funktioner som Booli-appen
- 🔍 Filtrera på min/max pris
- 🎨 Identiskt gränssnitt som Booli-appen

### Hemnet-scraper (`hemnet-scraper.js`)
- 🏠 Extraherar adress, område, priser
- 📏 Hämtar boyta, tomtarea, antal rum
- 📅 Såld datum och mäklarinformation
- 📊 Beräknar procentuell förändring
- 💾 Sparar data i `window.hemnetData`
- 📥 Möjlighet att ladda ner som JSON

## 🛠️ Teknisk information

### Servern
- Node.js HTTP-server
- Proxies för Booli Next.js API
- POST endpoint för att spara Hemnet-data
- Serverar statiska filer

### API Endpoints

**Booli:**
```
GET /api/booli?areaIds=2030&objectType=Villa&page=1&searchType=slutpriser
```

**Hemnet (fungerar ej - blockerad):**
```
GET /api/hemnet?locationIds=17851&itemTypes=villa&page=1
```

**Spara Hemnet-data:**
```
POST /api/hemnet-save
Content-Type: application/json

[{ "streetAddress": "...", ... }]
```

## 📍 Hitta rätt ID

### Booli Area ID
- Gå till Booli.se och sök efter ett område
- Kolla URL:en: `areaIds=2030`
- Exempel:
  - 2030 = Sollentuna
  - 473 = Stockholm

### Hemnet Location ID
- Gå till Hemnet.se och sök efter ett område
- Kolla URL:en: `location_ids%5B%5D=17851`
- Exempel:
  - 17851 = (ditt område)
  - 17744 = Stockholm
  - 898 = Göteborg

## 🤝 Dataformat

JSON-struktur för Hemnet-data:

```json
[
  {
    "streetAddress": "Bogghedsvägen 13",
    "location": "Östnor, Mora kommun",
    "askingPrice": 3658537,
    "finalPrice": 3000000,
    "percentChange": -18,
    "rooms": "5 rum",
    "livingArea": "170 m²",
    "plotArea": "2 952 m²",
    "soldDate": "18 okt. 2025",
    "broker": "Eric Thors Fastighetsbyrå AB"
  }
]
```

## 📝 Beräkning

`soldPricePercentageDiff` beräknas som:
```
((soldPrice - listPrice) / listPrice) * 100
```

- Ett positivt värde betyder att bostaden såldes över utgångspris
- Ett negativt värde betyder att bostaden såldes under utgångspris

## 📄 Notering

Detta är ett verktyg för personlig analys. Var vänlig mot Boolis och Hemnets servrar genom att:
- Begränsa antalet sidor du hämtar
- Inte köra automatiska skript för ofta
- Respektera eventuella rate limits
- Följa användarvillkoren för respektive tjänst
