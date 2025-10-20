// Hemnet Data Scraper - Kör detta script i DevTools Console på Hemnet
// Gå till: https://www.hemnet.se/salda/bostader?location_ids%5B%5D=17851&item_types%5B%5D=villa
// Öppna DevTools (Cmd+Option+I), gå till Console-fliken, klistra in detta script och tryck Enter

(function() {
    console.log('🏠 Hemnet Data Scraper startar...');

    // Hitta alla kort på sidan
    const cards = document.querySelectorAll('.Card_hclCard__DgSV3');

    if (cards.length === 0) {
        console.error('❌ Inga kort hittades. Är du på rätt sida?');
        return;
    }

    console.log(`📊 Hittade ${cards.length} fastigheter`);

    // Debug: Visa första kortet för att förstå strukturen
    if (cards.length > 0) {
        console.log('🔍 Debug: Första kortet:', cards[0]);
        console.log('🔍 Tagname:', cards[0].tagName);
        console.log('🔍 Href:', cards[0].getAttribute('href'));
        console.log('🔍 ID:', cards[0].getAttribute('id'));
    }

    const properties = [];

    cards.forEach((card, index) => {
        try {
            // Extrahera URL och ID från länken
            // Från HTML-strukturen: <a href="/salda/..." id="1382753718204968142" class="Card_hclCard__DgSV3">
            // Kortet SJÄLV är länken
            let url = '';
            let id = '';

            // Hämta id-attributet direkt från kortet (som är <a>-taggen)
            id = card.id || card.getAttribute('id') || '';

            // Hämta href från kortet
            const href = card.getAttribute('href') || '';

            // Bygg fullständig URL
            if (href) {
                if (href.startsWith('/')) {
                    url = `https://www.hemnet.se${href}`;
                } else if (href.startsWith('http')) {
                    url = href;
                }

                // Om ID fortfarande är tomt, extrahera från URL
                if (!id && href) {
                    // Hemnet ID är det sista numret i URL:en (19 siffror)
                    const idMatch = href.match(/(\d{19})$/);
                    if (idMatch) {
                        id = idMatch[1];
                    } else {
                        // Försök med kortare ID (kan variera)
                        const shortIdMatch = href.match(/(\d+)$/);
                        if (shortIdMatch) {
                            id = shortIdMatch[1];
                        }
                    }
                }
            }

            // Debug för första 3 kort
            if (index < 3) {
                console.log(`\nDebug kort ${index + 1}:`);
                console.log('  card.id:', card.id);
                console.log('  card.getAttribute("id"):', card.getAttribute('id'));
                console.log('  href:', href);
                console.log('  Extraherat ID:', id);
                console.log('  URL:', url);
            }

            // Extrahera adress
            const addressEl = card.querySelector('.Header_truncate__ebq7a');
            const streetAddress = addressEl ? addressEl.textContent.trim() : '';

            // Extrahera område
            const locationEl = card.querySelector('.Location_address___eOo4 span');
            const location = locationEl ? locationEl.textContent.trim() : '';

            // Extrahera slutpris
            const priceText = card.querySelector('.SellingPriceAttributes_contentWrapper__VaxX9 .Text_hclTextMedium__Ofovu');
            let finalPrice = 0;
            if (priceText) {
                const priceMatch = priceText.textContent.match(/Slutpris\s+([\d\s]+)/);
                if (priceMatch) {
                    finalPrice = parseInt(priceMatch[1].replace(/\s/g, ''));
                }
            }

            // Extrahera procentuell förändring
            const percentTexts = card.querySelectorAll('.SellingPriceAttributes_contentWrapper__VaxX9 .Text_hclTextMedium__Ofovu');
            let percentChange = 0;
            if (percentTexts.length > 1) {
                const percentMatch = percentTexts[1].textContent.match(/(-?\d+)\s*%/);
                if (percentMatch) {
                    percentChange = parseFloat(percentMatch[1]);
                }
            }

            // Beräkna utgångspris från slutpris och procent
            // Formel: slutpris = utgångspris * (1 + procent/100)
            // Därför: utgångspris = slutpris / (1 + procent/100)
            const askingPrice = percentChange !== 0
                ? Math.round(finalPrice / (1 + percentChange / 100))
                : finalPrice;

            // Extrahera rum och storlek
            const detailsTexts = card.querySelectorAll('.hcl-flex--container.hcl-flex--gap-2 p, .hcl-flex--container.hcl-flex--gap-2 span');
            let rooms = '';
            let livingArea = '';
            let plotArea = '';

            detailsTexts.forEach(el => {
                const text = el.textContent.trim();
                if (text.includes('m²') && text.includes('rum')) {
                    // Skip combined text
                } else if (text.includes('rum')) {
                    rooms = text;
                } else if (text.includes('m²')) {
                    if (!livingArea) {
                        livingArea = text;
                    } else {
                        plotArea = text;
                    }
                }
            });

            // Extrahera såld datum
            const soldLabel = card.querySelector('.Label_hclLabelSoldAt__oz_yQ');
            let soldDate = '';
            if (soldLabel) {
                const dateMatch = soldLabel.textContent.match(/Såld\s+(\d+\s+\w+\.?\s+\d+)/);
                if (dateMatch) {
                    soldDate = dateMatch[1];
                }
            }

            // Extrahera mäklare
            const brokerEl = card.querySelector('.BrokerInformation_truncateText__adDGk .NestBody_nestBody__ET2Ir');
            const broker = brokerEl ? brokerEl.textContent.trim() : '';

            const property = {
                id,
                streetAddress,
                location,
                askingPrice,
                finalPrice,
                percentChange,
                rooms,
                livingArea,
                plotArea,
                soldDate,
                broker,
                url
            };

            properties.push(property);

        } catch (error) {
            console.error(`❌ Fel vid bearbetning av kort ${index + 1}:`, error);
        }
    });

    // Beräkna genomsnitt
    const percentages = properties.map(p => p.percentChange).filter(p => !isNaN(p));
    const average = percentages.length > 0
        ? percentages.reduce((sum, val) => sum + val, 0) / percentages.length
        : 0;

    console.log('\n✅ DATA EXTRAHERAD!');
    console.log(`📈 Genomsnittlig förändring: ${average.toFixed(2)}%`);
    console.log(`🏘️  Antal fastigheter: ${properties.length}\n`);

    // Visa första fastigheterna som exempel
    console.log('📋 Exempel på data (första 3):');
    properties.slice(0, 3).forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.streetAddress}`);
        console.log(`   Område: ${prop.location}`);
        console.log(`   Utgångspris: ${prop.askingPrice.toLocaleString('sv-SE')} kr`);
        console.log(`   Slutpris: ${prop.finalPrice.toLocaleString('sv-SE')} kr`);
        console.log(`   Förändring: ${prop.percentChange}%`);
        console.log(`   Såld: ${prop.soldDate}`);
        console.log(`   URL: ${prop.url}`);
    });

    // Spara data som global variabel
    window.hemnetData = properties;
    window.hemnetStats = {
        average: average,
        count: properties.length,
        totalAskingPrice: properties.reduce((sum, p) => sum + p.askingPrice, 0),
        totalFinalPrice: properties.reduce((sum, p) => sum + p.finalPrice, 0)
    };

    console.log('\n💾 Data sparad i: window.hemnetData');
    console.log('📊 Statistik sparad i: window.hemnetStats');
    console.log('\n📥 För att kopiera all data som JSON, kör:');
    console.log('copy(JSON.stringify(window.hemnetData, null, 2))');
    console.log('\n📤 För att ladda ner som fil, kör:');
    console.log('downloadHemnetData()');

    // Funktion för att ladda ner data
    window.downloadHemnetData = function() {
        const dataStr = JSON.stringify({
            stats: window.hemnetStats,
            properties: window.hemnetData
        }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hemnet-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('✅ Data nedladdad!');
    };

    console.log('\n🎉 Klart! Scrolla ner och kör scriptet igen för att få med fler sidor.');

    return {
        properties: window.hemnetData,
        stats: window.hemnetStats
    };
})();
