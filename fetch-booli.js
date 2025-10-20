const https = require('https');
const fs = require('fs');

// Konfigurera dina sökparametrar här
const CONFIG = {
    areaId: '2030',        // Ändra till ditt område (2030 = Sollentuna)
    objectType: 'Villa',   // Villa, Lagenhet, eller Tomt
    maxPages: 50,          // Antal sidor att hämta (ca 50 per sida = 2500 totalt)
    buildId: 'ZkR8Hg784T7G7v1NGR8cH'  // Uppdateras om Booli ändrar sitt build-ID
};

const allProperties = [];
let fetchedPages = 0;

function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `https://www.booli.se/_next/data/${CONFIG.buildId}/sv/sok/slutpriser.json?areaIds=${CONFIG.areaId}&objectType=${CONFIG.objectType}&page=${page}&searchType=slutpriser`;

        const options = {
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9,sv-SE;q=0.8,sv;q=0.7',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                'x-nextjs-data': '1',
                'referer': 'https://www.booli.se/sok/slutpriser'
            }
        };

        console.log(`🔄 Hämtar sida ${page}...`);

        https.get(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    // Check if we got HTML instead of JSON (404 or error)
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        console.error(`❌ Sida ${page}: Fick HTML istället för JSON (kanske felaktigt build-ID?)`);
                        resolve([]);
                        return;
                    }

                    const json = JSON.parse(data);
                    const apolloState = json?.pageProps?.__APOLLO_STATE__;

                    if (!apolloState) {
                        console.error(`❌ Sida ${page}: Ingen Apollo state hittades`);
                        resolve([]);
                        return;
                    }

                    // Get the search result references
                    const searchKey = Object.keys(apolloState.ROOT_QUERY || {}).find(key =>
                        key.includes('searchSold')
                    );

                    if (!searchKey || !apolloState.ROOT_QUERY[searchKey]?.result) {
                        console.log(`ℹ️  Sida ${page}: Inga fler resultat`);
                        resolve([]);
                        return;
                    }

                    const propertyRefs = apolloState.ROOT_QUERY[searchKey].result;

                    if (propertyRefs.length === 0) {
                        console.log(`ℹ️  Sida ${page}: Tomt resultat`);
                        resolve([]);
                        return;
                    }

                    // Resolve property references
                    const properties = propertyRefs.map(ref => {
                        const propKey = ref.__ref;
                        return apolloState[propKey];
                    }).filter(prop => prop);

                    console.log(`✅ Sida ${page}: Hittade ${properties.length} fastigheter`);
                    fetchedPages++;
                    resolve(properties);

                } catch (error) {
                    console.error(`❌ Sida ${page}: Fel vid parsing:`, error.message);
                    resolve([]);
                }
            });

        }).on('error', (error) => {
            console.error(`❌ Sida ${page}: Nätverksfel:`, error.message);
            resolve([]);
        });
    });
}

async function fetchAll() {
    console.log('🏠 Booli Data Fetcher');
    console.log('=====================');
    console.log(`Område: ${CONFIG.areaId}`);
    console.log(`Typ: ${CONFIG.objectType}`);
    console.log(`Max sidor: ${CONFIG.maxPages}`);
    console.log('');

    for (let page = 1; page <= CONFIG.maxPages; page++) {
        const properties = await fetchPage(page);

        if (properties.length === 0) {
            console.log(`\nℹ️  Inga fler resultat på sida ${page}. Avslutar.`);
            break;
        }

        allProperties.push(...properties);

        // Wait a bit between requests to be nice to Booli's servers
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Sammanfattning');
    console.log('=================');
    console.log(`Totalt antal sidor hämtade: ${fetchedPages}`);
    console.log(`Totalt antal fastigheter: ${allProperties.length}`);

    if (allProperties.length > 0) {
        // Get date range
        const dates = allProperties
            .map(p => p.soldDate)
            .filter(d => d)
            .sort();

        if (dates.length > 0) {
            console.log(`Äldsta försäljning: ${dates[0]}`);
            console.log(`Nyaste försäljning: ${dates[dates.length - 1]}`);
        }

        // Calculate average percentage
        const percentages = allProperties
            .map(p => p.soldPricePercentageDiff?.raw)
            .filter(p => p !== null && p !== undefined && !isNaN(p));

        if (percentages.length > 0) {
            const avg = percentages.reduce((sum, val) => sum + val, 0) / percentages.length;
            console.log(`Genomsnittlig prisskillnad: ${avg.toFixed(2)}%`);
        }

        // Save to file
        console.log('\n💾 Sparar till booli.json...');
        fs.writeFileSync('booli.json', JSON.stringify(allProperties, null, 2));
        console.log('✅ Klart! Data sparad i booli.json');

    } else {
        console.log('\n⚠️  Ingen data att spara.');
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('\n❌ Oväntat fel:', error);
    process.exit(1);
});

// Run
fetchAll().catch((error) => {
    console.error('\n❌ Fel vid hämtning:', error);
    process.exit(1);
});
