const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

const ROOT_DIR = __dirname;
const STATIC_ROOTS = ['dist', 'public', '.']
    .map(dir => path.join(ROOT_DIR, dir))
    .filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory());

function resolveStaticFile(requestPath) {
    const safePath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');

    for (const root of STATIC_ROOTS) {
        const candidate = path.join(root, safePath);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }

    return null;
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Handle Hemnet API proxy requests
    if (parsedUrl.pathname === '/api/hemnet') {
        const { locationIds, itemTypes, page } = parsedUrl.query;

        const hemnetUrl = `https://www.hemnet.se/salda/bostader?location_ids%5B%5D=${locationIds}&item_types%5B%5D=${itemTypes}&page=${page || 1}`;

        const options = {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
                'accept-encoding': 'gzip, deflate, br',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="141", "Google Chrome";v="141", "Not=A?Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'cache-control': 'max-age=0',
                'referer': 'https://www.hemnet.se/'
            }
        };

        console.log('Fetching from Hemnet:', hemnetUrl);

        https.get(hemnetUrl, options, (hemnetRes) => {
            let data = '';

            console.log('Hemnet response status:', hemnetRes.statusCode);

            hemnetRes.on('data', (chunk) => {
                data += chunk;
            });

            hemnetRes.on('end', () => {
                // Extract JSON data from HTML page
                try {
                    // Hemnet embeds data in script tags - look for sold properties data
                    const scriptMatch = data.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);

                    if (!scriptMatch) {
                        console.error('Could not find __NEXT_DATA__ in Hemnet response');
                        res.writeHead(500, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({
                            error: 'Kunde inte hitta data i Hemnets svar. API:et kan ha ändrats.',
                            statusCode: hemnetRes.statusCode
                        }));
                        return;
                    }

                    const jsonData = JSON.parse(scriptMatch[1]);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify(jsonData));

                } catch (error) {
                    console.error('Error parsing Hemnet data:', error);
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        error: 'Kunde inte tolka data från Hemnet: ' + error.message
                    }));
                }
            });
        }).on('error', (error) => {
            console.error('Error fetching from Hemnet:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        });

        return;
    }

    // Handle saving Hemnet data
    if (parsedUrl.pathname === '/api/hemnet-save' && req.method === 'POST') {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                // Save to hemnet-data.json
                fs.writeFile('./hemnet-data.json', JSON.stringify(data, null, 2), (err) => {
                    if (err) {
                        console.error('Error saving Hemnet data:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Kunde inte spara filen' }));
                        return;
                    }

                    console.log(`Saved ${data.length} properties to hemnet-data.json`);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: true, count: data.length }));
                });

            } catch (error) {
                console.error('Error parsing Hemnet data:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ogiltigt JSON-format' }));
            }
        });

        return;
    }

    // Handle API proxy requests
    if (parsedUrl.pathname === '/api/booli') {
        const { areaIds, objectType, page, searchType } = parsedUrl.query;

        const booliUrl = `https://www.booli.se/_next/data/ZkR8Hg784T7G7v1NGR8cH/sv/sok/slutpriser.json?areaIds=${areaIds}&objectType=${objectType}&page=${page}&searchType=${searchType}`;

        const options = {
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9,sv-SE;q=0.8,sv;q=0.7',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                'x-nextjs-data': '1',
                'referer': 'https://www.booli.se/sok/slutpriser'
            }
        };

        console.log('Fetching from Booli:', booliUrl);

        https.get(booliUrl, options, (booliRes) => {
            let data = '';

            console.log('Booli response status:', booliRes.statusCode);
            console.log('Booli response headers:', booliRes.headers);

            booliRes.on('data', (chunk) => {
                data += chunk;
            });

            booliRes.on('end', () => {
                // Check if response is HTML (error page)
                if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                    console.error('Booli returned HTML instead of JSON:', data.substring(0, 200));
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        error: 'Booli returnerade HTML istället för JSON. API:et kan ha ändrats.',
                        statusCode: booliRes.statusCode,
                        preview: data.substring(0, 200)
                    }));
                    return;
                }

                res.writeHead(booliRes.statusCode, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (error) => {
            console.error('Error fetching from Booli:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        });

        return;
    }

    // Serve static files
    let requestPath = parsedUrl.pathname;
    if (requestPath === '/') {
        requestPath = '/index.html';
    } else if (requestPath.endsWith('/')) {
        requestPath = path.join(requestPath, 'index.html');
    }

    let filePath = resolveStaticFile(requestPath);

    if (!filePath && !path.extname(requestPath)) {
        filePath = resolveStaticFile('/index.html');
    }

    if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(500);
            res.end('Server Error: ' + error.code);
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Open http://localhost:${PORT}/ in your browser`);
});
