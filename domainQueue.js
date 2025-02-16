const axios = require('axios');
const config = require('./config');

class DomainQueue {
    constructor() {
        this.queue = [];
        this.results = {
            available: [], // Vai armazenar objetos {colA, domain}
            processing: false,
            total: 0,
            processed: 0
        };
    }

    addDomains(domains) {
        try {
            console.log('Adicionando domínios:', domains);
            this.queue = [...this.queue, ...domains];
            this.results.total += domains.length;
            
            if (!this.results.processing) {
                console.log('Iniciando processamento da fila');
                this.processQueue();
            }
        } catch (error) {
            console.error('Erro ao adicionar domínios:', error);
        }
    }

    async processQueue() {
        try {
            if (this.queue.length === 0) {
                console.log('Fila vazia, finalizando processamento');
                this.results.processing = false;
                return;
            }

            this.results.processing = true;
            const item = this.queue.shift();
            console.log('Verificando domínio:', item.domain);

            try {
                const response = await axios.get(`${config.api.baseUrl}/${item.domain}`);
                console.log('Resposta para', item.domain, ':', response.data);
                
                if (response.data.status === 0) {
                    console.log('Domínio disponível:', item.domain);
                    this.results.available.push(item);
                }
            } catch (error) {
                console.error(`Erro ao verificar domínio ${item.domain}:`, error.message);
            }
            
            this.results.processed++;
            await new Promise(resolve => setTimeout(resolve, config.api.requestDelay));
            this.processQueue();
        } catch (error) {
            console.error('Erro no processamento da fila:', error);
            this.results.processing = false;
        }
    }

    getProgress() {
        return {
            total: this.results.total,
            processed: this.results.processed,
            available: this.results.available.length,
            processing: this.results.processing
        };
    }

    clearResults() {
        this.queue = [];
        this.results = {
            available: [],
            processing: false,
            total: 0,
            processed: 0
        };
        console.log('DomainQueue: Cache e resultados limpos');
    }
}

module.exports = new DomainQueue();