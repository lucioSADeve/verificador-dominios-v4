const { parentPort } = require('worker_threads');
const { checkDomain } = require('./domainChecker'); // seu módulo de verificação de domínios

// Aumenta o número de verificações simultâneas
const CONCURRENT_BATCH_SIZE = 25; // Aumentado de 10 para 25

// Função para processar domínios em paralelo
async function processDomainsParallel(domains) {
    const results = [];
    const chunks = [];
    
    // Divide em chunks maiores para processamento mais rápido
    for (let i = 0; i < domains.length; i += CONCURRENT_BATCH_SIZE) {
        chunks.push(domains.slice(i, i + CONCURRENT_BATCH_SIZE));
    }

    // Processa chunks em paralelo
    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async domain => {
            try {
                const startTime = Date.now();
                const isAvailable = await checkDomain(domain.domain);
                const endTime = Date.now();
                
                // Se demorar mais de 5 segundos, considera como erro
                if (endTime - startTime > 5000) {
                    throw new Error('Timeout');
                }

                return {
                    ...domain,
                    available: isAvailable
                };
            } catch (error) {
                // Em caso de erro, tenta novamente uma vez
                try {
                    const isAvailable = await checkDomain(domain.domain);
                    return {
                        ...domain,
                        available: isAvailable
                    };
                } catch (retryError) {
                    return {
                        ...domain,
                        available: false,
                        error: true
                    };
                }
            }
        });

        // Usa Promise.all com timeout
        const results_timeout = await Promise.race([
            Promise.all(chunkPromises),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            )
        ]).catch(error => {
            console.error('Erro no chunk:', error);
            return chunk.map(domain => ({
                ...domain,
                available: false,
                error: true
            }));
        });

        results.push(...results_timeout);
        
        // Pequena pausa entre chunks para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

parentPort.on('message', async ({ domains, concurrent }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        parentPort.postMessage(results);
    } catch (error) {
        console.error('Erro no worker:', error);
        parentPort.postMessage([]);
    }
}); 