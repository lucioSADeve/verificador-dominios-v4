const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');

// Configurações ultra otimizadas
const CONCURRENT_LIMIT = 200; // Reduzido para evitar bloqueio
const BATCH_SIZE = 50; // Lotes menores para melhor feedback
const FETCH_TIMEOUT = 2000; // 2 segundos de timeout
const RETRY_DELAY = 100; // 100ms entre retentativas

// Cache otimizado
const resultsCache = new Map();

// Função otimizada para verificar domínio
async function checkDomain(domain) {
    // Verifica cache primeiro
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
        
        // Salva no cache
        resultsCache.set(domain, isAvailable);
        
        return isAvailable;
    } catch (error) {
        // Em caso de erro, considera como indisponível
        return false;
    }
}

// Processamento otimizado em lotes
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    let processed = 0;
    let available = 0;
    
    // Processa em lotes menores
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
        const batch = domains.slice(i, i + BATCH_SIZE);
        
        // Processa lote atual
        const batchPromises = batch.map(domain => 
            limit(async () => {
                try {
                    const isAvailable = await checkDomain(domain.domain);
                    processed++;
                    if (isAvailable) available++;
                    
                    // Reporta progresso a cada domínio
                    parentPort.postMessage({
                        type: 'progress',
                        processed,
                        total: domains.length,
                        available
                    });

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

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Pequena pausa entre lotes para evitar sobrecarga
        if (i + BATCH_SIZE < domains.length) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }

    return results;
}

// Listener de mensagens otimizado
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        
        // Limpa cache após processamento
        resultsCache.clear();
        
        parentPort.postMessage({ 
            type: 'complete', 
            results 
        });
    } catch (error) {
        console.error('Erro no worker:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    }
});

// Tratamento de erros
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
}); 