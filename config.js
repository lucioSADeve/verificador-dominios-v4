module.exports = {
    api: {
        baseUrl: 'https://registro.br/v2/ajax/avail/raw',
        requestDelay: 1000, // 1 segundo entre requisições
    },
    server: {
        port: process.env.PORT || 3000
    }
};