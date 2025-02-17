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
            timeout: 30000 // 30 segundos de timeout
        });
    }

    // Obter todos os perfis disponíveis
    async getProfiles() {
        try {
            console.log('Obtendo perfis do Dolphin Anty...');
            
            // Endpoint correto
            const response = await this.api.get('/browser_profiles');
            console.log('Resposta:', response.data);
            return response.data;
        } catch (error) {
            console.error('Erro ao obter perfis:', {
                message: error.message,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Iniciar perfil (endpoint da documentação)
    async startProfile(profileId) {
        const response = await this.api.post(`/browser_profiles/${profileId}/start`);
        return response.data;
    }

    // Criar uma nova aba (endpoint da documentação)
    async createTab(profileId) {
        const response = await this.api.post(`/browser_profiles/${profileId}/tabs`);
        return response.data;
    }

    // Executar ação (endpoint da documentação)
    async executeAction(profileId, action) {
        const response = await this.api.post(`/action/${profileId}`, action);
        return response.data;
    }
}

module.exports = new DolphinService(); 