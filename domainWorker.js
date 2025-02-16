const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');

// Configurações mais conservadoras
const CONCURRENT_LIMIT = 50; // Reduzido para evitar sobrecarga
const BATCH_SIZE = 10; // Lotes menores
const FETCH_TIMEOUT = 5000; // Aumentado para 5 segundos
const RETRY_DELAY = 200; // Aumentado delay entre tentativas
const PROCESS_TIMEOUT = 1800000; // 30 minutos de timeout total

// Cache otimizado
const resultsCache = new Map();

// Função otimizada para verificar domínio
async function checkDomain(domain) {
    if (resultsCache.has(domain)) {
        return resultsCache.get(domain);
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal,
                timeout: FETCH_TIMEOUT
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('API error');
            }

            const data = await response.json();
            const isAvailable = data.status === 'AVAILABLE';
            resultsCache.set(domain, isAvailable);
            return isAvailable;
        } catch (error) {
            if (attempt === 1) return false;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    return false;
}

// Processamento otimizado em lotes
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    let processed = 0;
    let available = 0;
    let lastProgressUpdate = Date.now();
    const startTime = Date.now();
    
    try {
        for (let i = 0; i < domains.length; i += BATCH_SIZE) {
            // Verifica timeout global
            if (Date.now() - startTime > PROCESS_TIMEOUT) {
                throw new Error('Tempo máximo de processamento excedido');
            }

            const batch = domains.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(domain => 
                limit(async () => {
                    try {
                        const isAvailable = await checkDomain(domain.domain);
                        processed++;
                        if (isAvailable) available++;
                        
                        // Atualiza progresso mais frequentemente
                        const now = Date.now();
                        if (now - lastProgressUpdate >= 200) {
                            parentPort.postMessage({
                                type: 'progress',
                                processed,
                                total: domains.length,
                                available,
                                timeElapsed: Math.floor((now - startTime) / 1000)
                            });
                            lastProgressUpdate = now;
                        }

                        return {
                            ...domain,
                            available: isAvailable
                        };
                    } catch (error) {
                        processed++;
                        return {
                            ...domain,
                            available: false,
                            error: true
                        };
                    }
                })
            );

            const batchResults = await Promise.allSettled(batchPromises);
            const validResults = batchResults
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);
            
            results.push(...validResults);

            // Pausa entre lotes
            if (i + BATCH_SIZE < domains.length) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }

        return results;
    } catch (error) {
        // Salva resultados parciais em caso de erro
        parentPort.postMessage({
            type: 'partial_results',
            results,
            processed,
            total: domains.length,
            available,
            error: error.message
        });
        throw error;
    }
}

// Listener de mensagens
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        
        resultsCache.clear();
        
        parentPort.postMessage({ 
            type: 'complete', 
            results 
        });
    } catch (error) {
        console.error('Erro fatal:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message || 'Erro no processamento'
        });
    }
});

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
    parentPort.postMessage({ 
        type: 'error', 
        error: 'Erro interno no processamento'
    });
}); 