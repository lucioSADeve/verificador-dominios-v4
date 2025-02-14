const { parentPort } = require('worker_threads');
const { checkDomain } = require('./domainChecker'); // seu módulo de verificação de domínios

parentPort.on('message', async (domains) => {
    try {
        const results = [];
        for (const domain of domains) {
            const isAvailable = await checkDomain(domain.domain);
            results.push({
                ...domain,
                available: isAvailable
            });
        }
        parentPort.postMessage(results);
    } catch (error) {
        console.error('Erro no worker:', error);
        parentPort.postMessage([]);
    }
}); 