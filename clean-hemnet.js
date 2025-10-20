const fs = require('fs');

console.log('🧹 Rensar hemnet.json...\n');

// Läs filen
const data = JSON.parse(fs.readFileSync('hemnet.json', 'utf8'));

console.log(`📊 Före rensning: ${data.length} objekt`);

// Filtrera bort tomma/ogiltiga objekt
const cleaned = data.filter(property => {
    // Ett giltigt objekt måste ha:
    // 1. En adress
    // 2. Ett pris (antingen askingPrice eller finalPrice)
    // 3. Ett ID som ser ut som ett Hemnet-ID (minst 10 siffror)

    const hasAddress = property.streetAddress && property.streetAddress.trim() !== '';
    const hasPrice = (property.askingPrice > 0) || (property.finalPrice > 0);
    const hasValidId = property.id && property.id.length >= 10 && /^\d+$/.test(property.id);

    const isValid = hasAddress && hasPrice && hasValidId;

    if (!isValid) {
        console.log(`❌ Tar bort: ${property.streetAddress || 'Ingen adress'} (ID: ${property.id || 'Inget ID'}, URL: ${property.url?.substring(0, 50) || 'Ingen URL'}...)`);
    }

    return isValid;
});

console.log(`\n✅ Efter rensning: ${cleaned.length} objekt`);
console.log(`🗑️  Borttagna: ${data.length - cleaned.length} objekt\n`);

// Visa statistik
if (cleaned.length > 0) {
    const dates = cleaned
        .map(p => p.soldDate)
        .filter(d => d)
        .sort();

    const avgPercent = cleaned
        .map(p => p.percentChange)
        .filter(p => !isNaN(p))
        .reduce((sum, val) => sum + val, 0) / cleaned.length;

    console.log('📊 Statistik för rensad data:');
    console.log(`   Antal fastigheter: ${cleaned.length}`);
    if (dates.length > 0) {
        console.log(`   Äldsta: ${dates[0]}`);
        console.log(`   Nyaste: ${dates[dates.length - 1]}`);
    }
    console.log(`   Genomsnitt: ${avgPercent.toFixed(2)}%\n`);
}

// Spara tillbaka
fs.writeFileSync('hemnet.json', JSON.stringify(cleaned, null, 2));

console.log('💾 Sparad till hemnet.json');
console.log('✅ Klart!');
