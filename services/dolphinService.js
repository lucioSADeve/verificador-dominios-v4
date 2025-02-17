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
        const response = await this.api.get('/profiles');
        return response.data;
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