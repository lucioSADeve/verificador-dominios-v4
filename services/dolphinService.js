const axios = require('axios');
const config = require('../config');

class DolphinService {
    constructor() {
        this.api = axios.create({
            baseURL: config.dolphin.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.dolphin.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Dolphin-Anty-Client'
            },
            timeout: 30000 // aumentado para 30 segundos
        });
    }

    // Obter todos os perfis disponíveis
    async getProfiles() {
        try {
            console.log('Configuração da API:', {
                baseURL: this.api.defaults.baseURL,
                headers: this.api.defaults.headers
            });
            
            // Endpoint para listar perfis
            const response = await this.api.get('/browser_profiles');
            console.log('Resposta:', response.data);
            return response.data;
        } catch (error) {
            console.error('Erro detalhado:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: error.config,
                url: `${config.dolphin.baseUrl}/browser_profiles`,
                method: error.config?.method
            });
            throw error;
        }
    }

    // Iniciar um perfil específico
    async startProfile(profileId) {
        const response = await this.api.post(`/profiles/${profileId}/start`);
        return response.data;
    }

    // Criar uma nova aba no perfil
    async createTab(profileId, url) {
        const response = await this.api.post(`/profiles/${profileId}/tabs`, {
            url: url
        });
        return response.data;
    }

    // Executar ação em uma aba
    async executeAction(profileId, tabId, action) {
        const response = await this.api.post(`/profiles/${profileId}/tabs/${tabId}/execute`, {
            action: action
        });
        return response.data;
    }
}

module.exports = new DolphinService(); 