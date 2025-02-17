const config = {
    api: {
        baseUrl: 'https://registro.br/v2/ajax/avail/raw',  // Esta é a URL correta do registro.br
        requestDelay: 1000 // 1 segundo entre requisições
    },
    server: {
        port: process.env.PORT || 3000
    },
    // Configuração para armazenamento temporário na Vercel
    tempStorage: '/tmp'
};

module.exports = config;