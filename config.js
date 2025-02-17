const config = {
    api: {
        baseUrl: process.env.NODE_ENV === 'production' 
            ? 'https://verificador-dominios-v4.vercel.app/api'
            : 'http://localhost:3000/api',
        requestDelay: 1000 // 1 segundo entre requisições
    },
    server: {
        port: process.env.PORT || 3000
    },
    // Configuração para armazenamento temporário na Vercel
    tempStorage: '/tmp'
};

module.exports = config;