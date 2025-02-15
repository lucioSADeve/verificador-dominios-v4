const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');
const dns = require('dns').promises;

// Configurações otimizadas
const CONCURRENT_LIMIT = 50; // Aumentado para 50 verificações simultâneas
const TIMEOUT = 3000; // Reduzido para 3 segundos
const RETRY_DELAY = 50; // 50ms entre tentativas

// Função otimizada para verificar domínio
async function checkDomain(domain) {
    try {
        // Tenta resolver o domínio com timeout
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

// Função otimizada para processar domínios em paralelo
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    let processed = 0;
    const total = domains.length;

    // Processa em lotes com limite de concorrência
    const promises = domains.map((domain, index) => 
        limit(async () => {
            try {
                const isAvailable = await checkDomain(domain.domain);
                processed++;
                
                // Reporta progresso a cada 5%
                if (processed % Math.max(1, Math.floor(total * 0.05)) === 0) {
                    parentPort.postMessage({
                        type: 'progress',
                        processed,
                        total
                    });
                }

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
            } finally {
                // Pequena pausa entre verificações
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        })
    );

    try {
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    } catch (error) {
        console.error('Erro no processamento:', error);
        return [];
    }
}

// Listener de mensagens otimizado
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        parentPort.postMessage({ type: 'complete', results });
    } catch (error) {
        console.error('Erro fatal no worker:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    }
}); 