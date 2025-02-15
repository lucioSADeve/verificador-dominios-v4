const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');

// Configurações ajustadas
const CONCURRENT_LIMIT = 100; // Reduzido para maior estabilidade
const BATCH_SIZE = 25; // Lotes menores
const FETCH_TIMEOUT = 3000; // Aumentado para 3 segundos
const RETRY_DELAY = 50; // Reduzido delay entre tentativas

// Cache otimizado
const resultsCache = new Map();

// Função otimizada para verificar domínio
async function checkDomain(domain) {
    if (resultsCache.has(domain)) {
        return resultsCache.get(domain);
    }

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
        // Tenta uma segunda vez em caso de erro
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
                timeout: FETCH_TIMEOUT
            });
            const data = await response.json();
            const isAvailable = data.status === 'AVAILABLE';
            resultsCache.set(domain, isAvailable);
            return isAvailable;
        } catch {
            return false;
        }
    }
}

// Processamento otimizado em lotes
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    let processed = 0;
    let available = 0;
    let lastProgressUpdate = Date.now();
    
    try {
        for (let i = 0; i < domains.length; i += BATCH_SIZE) {
            const batch = domains.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(domain => 
                limit(async () => {
                    try {
                        const isAvailable = await checkDomain(domain.domain);
                        processed++;
                        if (isAvailable) available++;
                        
                        // Atualiza progresso a cada 500ms
                        const now = Date.now();
                        if (now - lastProgressUpdate >= 500) {
                            parentPort.postMessage({
                                type: 'progress',
                                processed,
                                total: domains.length,
                                available
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
            results.push(...batchResults
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value)
            );

            // Pequena pausa entre lotes
            if (i + BATCH_SIZE < domains.length) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }

        return results;
    } catch (error) {
        console.error('Erro no processamento:', error);
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