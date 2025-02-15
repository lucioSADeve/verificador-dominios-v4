const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');
const dns = require('dns').promises;

// Aumenta os limites de processamento
const CONCURRENT_LIMIT = 100; // Aumentado para 100 verificações simultâneas
const TIMEOUT = 2000; // Reduzido para 2 segundos
const RETRY_DELAY = 20; // Reduzido para 20ms

// Função otimizada para verificar domínio
async function checkDomain(domain) {
    try {
        await Promise.race([
            dns.resolve(domain),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), TIMEOUT)
            )
        ]);
        return false; // Domínio existe
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            // Verifica no Registro.br
            try {
                const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
                    timeout: TIMEOUT
                });
                const data = await response.json();
                return data.status === 'AVAILABLE';
            } catch {
                return false; // Em caso de erro, considera indisponível
            }
        }
        return false;
    }
}

// Processamento em lotes otimizado
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const batchSize = 50; // Processa 50 domínios por vez
    const results = [];
    
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
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

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Reporta progresso
        parentPort.postMessage({
            type: 'progress',
            processed: results.length,
            total: domains.length,
            available: results.filter(r => r.available).length
        });
    }

    return results;
}

// Listener de mensagens otimizado
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
    }
}); 