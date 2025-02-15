const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');
const dns = require('dns').promises;

// Configurações ultra otimizadas
const CONCURRENT_LIMIT = 500; // Aumentado para 500 verificações simultâneas
const BATCH_SIZE = 200; // Aumentado para 200 domínios por lote
const TIMEOUT = 1000; // Reduzido para 1 segundo
const MAX_RETRIES = 1; // Reduzido para 1 tentativa
const FETCH_TIMEOUT = 800; // Timeout específico para Registro.br

// Cache em memória
const resultsCache = new Map();
const failedCache = new Set();

// Função ultra otimizada para verificar domínio
async function checkDomain(domain) {
    if (resultsCache.has(domain)) {
        return resultsCache.get(domain);
    }

    // Ignora domínios que falharam recentemente
    if (failedCache.has(domain)) {
        return false;
    }

    try {
        // Verifica APENAS no Registro.br (mais rápido)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
            timeout: FETCH_TIMEOUT,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error('Registro.br error');
        }

        const data = await response.json();
        const isAvailable = data.status === 'AVAILABLE';
        resultsCache.set(domain, isAvailable);
        return isAvailable;
    } catch (error) {
        // Em caso de erro, marca como indisponível
        failedCache.add(domain);
        return false;
    }
}

// Processamento ultra otimizado em lotes
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    const batches = [];

    // Limpa caches antigos
    if (resultsCache.size > 5000) resultsCache.clear();
    if (failedCache.size > 5000) failedCache.clear();

    // Divide em lotes maiores
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
        batches.push(domains.slice(i, i + BATCH_SIZE));
    }

    // Processa lotes em paralelo com timeout
    for (const batch of batches) {
        const batchPromises = batch.map(domain => 
            limit(async () => {
                try {
                    const isAvailable = await checkDomain(domain.domain);
                    return {
                        ...domain,
                        available: isAvailable
                    };
                } catch (error) {
                    return {
                        ...domain,
                        available: false,
                        error: true
                    };
                }
            })
        );

        // Processa lote com timeout
        const batchResults = await Promise.race([
            Promise.all(batchPromises),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Batch timeout')), TIMEOUT * BATCH_SIZE)
            )
        ]).catch(error => {
            console.error('Erro no batch:', error);
            return batch.map(domain => ({
                ...domain,
                available: false,
                error: true
            }));
        });

        results.push(...batchResults);

        // Reporta progresso
        const available = results.filter(r => r.available).length;
        parentPort.postMessage({
            type: 'progress',
            processed: results.length,
            total: domains.length,
            available
        });
    }

    return results;
}

// Listener otimizado
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        parentPort.postMessage({ type: 'complete', results });
    } catch (error) {
        console.error('Erro no worker:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    } finally {
        // Limpa caches ao finalizar
        resultsCache.clear();
        failedCache.clear();
    }
}); 