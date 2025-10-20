# Hur man hämtar data från Hemnet

Eftersom Hemnet blockerar automatisk datahämtning måste du använda webbläsarens DevTools för att extrahera data.

## Steg-för-steg instruktioner

### 1. Gå till Hemnet
Öppna din webbläsare och navigera till:
```
https://www.hemnet.se/salda/bostader?location_ids%5B%5D=17851&item_types%5B%5D=villa
```

Ändra `location_ids` och `item_types` efter behov:
- **Location IDs**:
  - 17851 (ditt område)
  - 17744 (Stockholm)
  - 898 (Göteborg)

- **Item types**:
  - `villa` (Villa)
  - `bostadsratt` (Lägenhet/Bostadsrätt)
  - `tomt` (Tomt)

### 2. Öppna DevTools
- **Mac**: `Cmd + Option + I`
- **Windows/Linux**: `Ctrl + Shift + I`
- Eller högerklicka på sidan och välj "Inspektera"

### 3. Gå till Console-fliken
Klicka på fliken "Console" i DevTools

### 4. Kör scriptet
1. Öppna filen `hemnet-scraper.js` i denna mapp
2. Kopiera hela innehållet (Cmd+A, Cmd+C)
3. Klistra in i Console (Cmd+V)
4. Tryck Enter

### 5. Se resultatet
Scriptet kommer att:
- ✅ Extrahera alla fastigheter på sidan
- 📊 Beräkna genomsnittlig prisförändring
- 💾 Spara data i `window.hemnetData`

### 6. Exportera data

**Alternativ A - Kopiera som JSON:**
```javascript
copy(JSON.stringify(window.hemnetData, null, 2))
```
Klistra sedan in i en textfil

**Alternativ B - Ladda ner som fil:**
```javascript
downloadHemnetData()
```

### 7. Hämta flera sidor
1. Scrolla ner till slutet av sidan
2. Klicka på "Nästa sida" eller sida 2, 3, osv.
3. Kör scriptet igen för varje sida
4. Data kommer att ackumuleras i `window.hemnetData`

## Vad scriptet extraherar

För varje fastighet hämtas:
- 🏠 **Adress**: Gatuadress
- 📍 **Område**: Stad/kommun
- 💰 **Utgångspris**: Beräknat från slutpris och procent
- 💵 **Slutpris**: Faktiskt försäljningspris
- 📈 **Procentförändring**: Skillnad mellan utgångs- och slutpris
- 🛏️ **Rum**: Antal rum
- 📏 **Boyta**: Kvadratmeter boyta
- 🌳 **Tomtarea**: Kvadratmeter tomt
- 📅 **Såld datum**: När fastigheten såldes
- 🏢 **Mäklare**: Mäklarfirma

## Visa data i en snygg vy

### Första gången - Hämta och spara data:

1. **Kör scriptet på Hemnet** (se steg ovan)

2. **Kopiera datan:**
   ```javascript
   copy(JSON.stringify(window.hemnetData, null, 2))
   ```

3. **Öppna viewern:**
   - Gå till: `http://localhost:3000/hemnet-viewer.html`

4. **Klistra in JSON-datan** i textrutan

5. **Klicka "Ladda & Spara data"** - Detta sparar data till `hemnet-data.json`

### Nästa gånger - Ladda sparad data:

1. **Öppna viewern:** `http://localhost:3000/hemnet-viewer.html`

2. **Klicka "Ladda från fil"** - Laddar automatiskt från `hemnet-data.json`

3. Färdig! All data visas direkt.

### Funktioner i viewern:
- 📊 Visar genomsnittlig prisförändring
- 🏘️ Listar alla fastigheter med detaljer
- 🔍 Filtrera på min/max pris
- 🎨 Snyggt visuellt gränssnitt
- 📱 Fungerar på mobil och desktop

## Använd data i appen

Du kan också använda data direkt i Console:

```javascript
// Visa statistik
console.table(window.hemnetStats);

// Visa alla fastigheter
console.table(window.hemnetData);

// Filtrera fastigheter över 3 miljoner
window.hemnetData.filter(p => p.finalPrice > 3000000);

// Hitta fastigheter med störst prisökning
window.hemnetData.sort((a, b) => b.percentChange - a.percentChange).slice(0, 10);
```

## Tips

- 💡 Kör scriptet direkt när sidan laddats
- 🔄 För bästa resultat, ladda om sidan mellan körningar
- 📱 Fungerar både på desktop och mobil
- 🚀 Snabbt - tar bara några sekunder per sida
- ✅ Helt säkert - körs bara i din webbläsare

## Felsökning

**Problem: "Inga kort hittades"**
- Kontrollera att du är på rätt sida (salda/bostader)
- Vänta tills sidan laddat klart
- Prova ladda om sidan

**Problem: Data ser konstigt ut**
- Hemnet kan ha ändrat sin HTML-struktur
- Kontakta mig så kan jag uppdatera scriptet

**Problem: Vill ha all data automatiskt**
- Tyvärr blockerar Hemnet automatisk hämtning
- Detta är det bästa alternativet för närvarande
