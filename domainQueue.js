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
                // Adicionando headers para simular um navegador
                const response = await axios.get(`https://registro.br/v2/ajax/avail/raw/${item.domain}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': 'https://registro.br/',
                        'Origin': 'https://registro.br'
                    },
                    timeout: 5000 // 5 segundos de timeout
                });

                console.log('Resposta bruta para', item.domain, ':', response.data);
                
                // Verificação mais robusta do status
                if (response.data && 
                    (response.data.status === '0' || response.data.status === 0 || response.data.available === true)) {
                    console.log('Domínio disponível:', item.domain);
                    this.results.available.push(item);
                }
            } catch (error) {
                console.error(`Erro ao verificar domínio ${item.domain}:`, error.message);
                // Tenta novamente em caso de erro
                this.queue.push(item);
                this.results.processed--; // Desconta o processamento que falhou
            }
            
            this.results.processed++;
            // Aumentando o delay entre requisições para evitar bloqueio
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
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