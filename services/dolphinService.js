const axios = require('axios');
const config = require('../config');

class DolphinService {
    constructor() {
        this.api = axios.create({
            baseURL: config.dolphin.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.dolphin.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // Obter todos os perfis disponíveis
    async getProfiles() {
        try {
            console.log('Configuração da API:', {
                baseURL: this.api.defaults.baseURL,
                headers: this.api.defaults.headers
            });
            
            // Endpoint correto da documentação
            const response = await this.api.get('/profiles');
            console.log('Resposta:', response.data);
            return response.data;
        } catch (error) {
            console.error('Erro detalhado:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: error.config
            });
            throw error;
        }
    }

    // Iniciar um perfil específico (endpoint da documentação)
    async startProfile(profileId) {
        const response = await this.api.post(`/start/${profileId}`);
        return response.data;
    }

    // Criar uma nova aba (endpoint da documentação)
    async createTab(profileId) {
        const response = await this.api.post(`/new-tab/${profileId}`);
        return response.data;
    }

    // Executar ação (endpoint da documentação)
    async executeAction(profileId, action) {
        const response = await this.api.post(`/action/${profileId}`, action);
        return response.data;
    }
}

module.exports = new DolphinService(); 