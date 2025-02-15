const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');

// Configurações extremas
const CONCURRENT_LIMIT = 1000; // 1000 verificações simultâneas
const BATCH_SIZE = 500; // 500 domínios por lote
const FETCH_TIMEOUT = 500; // Apenas 500ms de timeout
const MAX_CACHE_SIZE = 10000;

// Sistema de cache otimizado
const resultsCache = new Map();
const failedCache = new Set();
const inProgressCache = new Set();

// Pool de conexões pré-aquecidas
const connectionPool = new Set();
for (let i = 0; i < 10; i++) {
    connectionPool.add(new fetch.Request('https://registro.br'));
}

// Função extremamente otimizada para verificar domínio
async function checkDomain(domain) {
    // Verificações em cache
    if (resultsCache.has(domain)) return resultsCache.get(domain);
    if (failedCache.has(domain)) return false;
    if (inProgressCache.has(domain)) return false;

    try {
        inProgressCache.add(domain);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
            timeout: FETCH_TIMEOUT,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
            keepalive: true
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const isAvailable = data.status === 'AVAILABLE';
        
        // Cache otimizado
        if (resultsCache.size > MAX_CACHE_SIZE) {
            const oldestKey = resultsCache.keys().next().value;
            resultsCache.delete(oldestKey);
        }
        resultsCache.set(domain, isAvailable);
        
        return isAvailable;
    } catch (error) {
        failedCache.add(domain);
        return false;
    } finally {
        inProgressCache.delete(domain);
    }
}

// Processamento extremamente otimizado
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = new Array(domains.length);
    let processed = 0;
    
    // Limpa caches periodicamente
    const clearCaches = () => {
        if (resultsCache.size > MAX_CACHE_SIZE) resultsCache.clear();
        if (failedCache.size > MAX_CACHE_SIZE) failedCache.clear();
        inProgressCache.clear();
    };

    // Processa em super lotes
    const batches = new Array(Math.ceil(domains.length / BATCH_SIZE))
        .fill()
        .map((_, i) => domains.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));

    for (const batch of batches) {
        const promises = batch.map((domain, index) => 
            limit(async () => {
                try {
                    const isAvailable = await checkDomain(domain.domain);
                    results[processed + index] = {
                        ...domain,
                        available: isAvailable
                    };
                } catch {
                    results[processed + index] = {
                        ...domain,
                        available: false,
                        error: true
                    };
                }
            })
        );

        await Promise.all(promises);
        processed += batch.length;

        // Reporta progresso
        parentPort.postMessage({
            type: 'progress',
            processed,
            total: domains.length,
            available: results.filter(r => r && r.available).length
        });

        clearCaches();
        await new Promise(resolve => setTimeout(resolve, 10)); // Micro pausa entre lotes
    }

    return results.filter(Boolean);
}

// Listener otimizado
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        parentPort.postMessage({ type: 'complete', results });
    } catch (error) {
        console.error('Erro:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    } finally {
        resultsCache.clear();
        failedCache.clear();
        inProgressCache.clear();
    }
});

// Tratamento de erros global
process.on('uncaughtException', (error) => {
    console.error('Erro não tratado:', error);
    process.exit(1);
}); 