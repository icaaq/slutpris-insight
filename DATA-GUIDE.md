# Guide: Fylla booli.json och hemnet.json med data

Denna guide beskriver hur du fyller `booli.json` och `hemnet.json` med försäljningsdata från de senaste 2 åren.

## 📋 Dataformat

Båda filerna ska vara JSON-arrayer med försäljningar. Här är det förväntade formatet:

### booli.json
```json
[
  {
    "id": "1234567890",
    "streetAddress": "Exempelvägen 1",
    "descriptiveAreaName": "Sollentuna",
    "listPrice": { "raw": 5000000 },
    "soldPrice": { "raw": 5200000 },
    "soldPricePercentageDiff": { "raw": 4 },
    "soldDate": "2024-03-15",
    "objectType": "Villa"
  }
]
```

### hemnet.json
```json
[
  {
    "id": "1382753718204968142",
    "streetAddress": "Bogghedsvägen 13",
    "location": "Östnor, Mora kommun",
    "askingPrice": 3658537,
    "finalPrice": 3000000,
    "percentChange": -18,
    "rooms": "5 rum",
    "livingArea": "170 m²",
    "plotArea": "2 952 m²",
    "soldDate": "2025-10-18",
    "broker": "Eric Thors Fastighetsbyrå AB",
    "url": "https://www.hemnet.se/salda/villa-5rum-ostnor-mora-kommun-bogghedsvagen-13-1382753718204968142"
  }
]
```

## 🔄 Hämta data från Booli

### Automatisk metod (Rekommenderas)

1. **Använd befintlig app:**
   ```bash
   node server.js
   ```

2. **Öppna** `http://localhost:3000/index.html`

3. **Välj Booli** som datakälla

4. **Ange sökparametrar:**
   - Area ID: 2030 (eller ditt område)
   - Objekttyp: Villa
   - Max sidor: 20 (för att få ~2 års data)

5. **Klicka "Hämta data"**

6. **Öppna DevTools Console** och kör:
   ```javascript
   // Kopiera all data som JSON
   copy(JSON.stringify(window.allProperties || [], null, 2))
   ```

7. **Klistra in i `booli.json`**

### Manuell metod

1. Gå till Booli.se och sök efter ditt område
2. Filtrera på "Sålda bostäder"
3. Använd browserns DevTools för att inspektera nätverksförfrågningar
4. Hitta API-anrop till `/_next/data/...`
5. Kopiera JSON-responsen
6. Extrahera relevant data och formatera enligt ovan

## 🔄 Hämta data från Hemnet

### Använd hemnet-scraper.js

1. **Gå till Hemnet:**
   ```
   https://www.hemnet.se/salda/bostader?location_ids%5B%5D=17851&item_types%5B%5D=villa
   ```

2. **Justera parametrar:**
   - Ändra `location_ids` till ditt område
   - Ändra `item_types` till önskad typ (villa/bostadsratt)

3. **Öppna DevTools** (`Cmd+Option+I`)

4. **Kör scriptet** från `hemnet-scraper.js`

5. **Scrolla igenom flera sidor** och kör scriptet på varje sida för att samla mer data

6. **Kopiera all data:**
   ```javascript
   copy(JSON.stringify(window.hemnetData, null, 2))
   ```

7. **Klistra in i `hemnet.json`**

## 📊 Hur mycket data behövs för ~2 år?

### Uppskattning per område:
- **Storstad (Stockholm, Göteborg):**
  - Villor: ~500-1000 försäljningar
  - Lägenheter: ~2000-5000 försäljningar

- **Mellanstor stad:**
  - Villor: ~200-500 försäljningar
  - Lägenheter: ~500-1500 försäljningar

- **Mindre område:**
  - Villor: ~50-200 försäljningar
  - Lägenheter: ~100-500 försäljningar

### Tips:
- Börja med att hämta 20 sidor från varje källa
- Kontrollera datum på de äldsta försäljningarna
- Hämta fler sidor om det behövs för att nå 2 år tillbaka

## ⚙️ Automatisera datahämtning

### För Booli (fungerar):

Skapa ett script `fetch-booli.js`:

```javascript
const https = require('https');
const fs = require('fs');

const areaId = '2030'; // Ändra till ditt område
const maxPages = 20;
const allProperties = [];

async function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `https://www.booli.se/_next/data/ZkR8Hg784T7G7v1NGR8cH/sv/sok/slutpriser.json?areaIds=${areaId}&objectType=Villa&page=${page}&searchType=slutpriser`;

        const options = {
            headers: {
                'accept': '*/*',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'x-nextjs-data': '1',
                'referer': 'https://www.booli.se/sok/slutpriser'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const apolloState = json?.pageProps?.__APOLLO_STATE__;

                    if (apolloState) {
                        const searchKey = Object.keys(apolloState.ROOT_QUERY || {})
                            .find(key => key.includes('searchSold'));

                        if (searchKey) {
                            const propertyRefs = apolloState.ROOT_QUERY[searchKey].result || [];
                            const properties = propertyRefs.map(ref => apolloState[ref.__ref]);
                            resolve(properties);
                            return;
                        }
                    }
                    resolve([]);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function fetchAll() {
    for (let page = 1; page <= maxPages; page++) {
        console.log(`Hämtar sida ${page}...`);
        const properties = await fetchPage(page);

        if (properties.length === 0) break;

        allProperties.push(...properties);

        // Vänta lite mellan förfrågningar
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    fs.writeFileSync('booli.json', JSON.stringify(allProperties, null, 2));
    console.log(`✅ Sparat ${allProperties.length} fastigheter till booli.json`);
}

fetchAll().catch(console.error);
```

Kör med: `node fetch-booli.js`

## 🎯 Verifiera data

Efter att du fyllt filerna:

1. **Kontrollera antal:**
   ```bash
   cat booli.json | grep "streetAddress" | wc -l
   cat hemnet.json | grep "streetAddress" | wc -l
   ```

2. **Kontrollera datum:**
   - Öppna filerna i en editor
   - Kolla att äldsta försäljningen är ~2 år gammal

3. **Testa appen:**
   ```bash
   node server.js
   ```

   Öppna `http://localhost:3000/app.html` och se att data laddas!

## 📝 Underhåll

### Uppdatera data månadsvis:
1. Hämta ny data från senaste månaden
2. Lägg till i början av JSON-arrayen
3. Ta bort data äldre än 2 år från slutet

### Exempel med jq (kommandoradsverktyg):
```bash
# Kombinera ny och gammal data, sortera på datum
jq -s '.[0] + .[1] | sort_by(.soldDate) | reverse' new-data.json booli.json > updated.json
mv updated.json booli.json
```

## ❓ Felsökning

**Problem: Tomma filer**
- Kontrollera att servern körs
- Kolla browserns Network-flik för fel
- Se till att JSON-syntaxen är korrekt

**Problem: Datum saknas**
- Vissa försäljningar kanske saknar datum
- Lägg till ett standarddatum eller filtrera bort dem

**Problem: För lite data**
- Öka antal sidor som hämtas
- Hämta från flera områden
- Inkludera fler objekttyper
