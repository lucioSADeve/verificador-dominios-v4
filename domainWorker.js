const { parentPort } = require('worker_threads');
const { checkDomain } = require('./domainChecker'); // seu módulo de verificação de domínios

// Função para processar domínios em paralelo
async function processDomainsParallel(domains, concurrent = 10) {
    const results = [];
    const chunks = [];
    
    // Divide em chunks para processamento paralelo
    for (let i = 0; i < domains.length; i += concurrent) {
        chunks.push(domains.slice(i, i + concurrent));
    }

    // Processa cada chunk
    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async domain => {
            try {
                const isAvailable = await checkDomain(domain.domain);
                return {
                    ...domain,
                    available: isAvailable
                };
            } catch (error) {
                console.error(`Erro ao verificar ${domain.domain}:`, error);
                return {
                    ...domain,
                    available: false,
                    error: true
                };
            }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
    }

    return results;
}

parentPort.on('message', async ({ domains, concurrent }) => {
    try {
        const results = await processDomainsParallel(domains, concurrent);
        parentPort.postMessage(results);
    } catch (error) {
        console.error('Erro no worker:', error);
        parentPort.postMessage([]);
    }
}); 