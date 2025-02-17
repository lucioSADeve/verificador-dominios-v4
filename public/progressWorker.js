let progressInterval;

console.log('Worker iniciado');

self.onmessage = function(e) {
    console.log('Mensagem recebida no Worker:', e.data);
    
    if (e.data === 'start') {
        console.log('Iniciando verificação de progresso');
        checkProgress(); // Primeira verificação imediata
        progressInterval = setInterval(checkProgress, 3000);
    } else if (e.data === 'stop') {
        console.log('Parando verificação');
        clearInterval(progressInterval);
    }
};

async function checkProgress() {
    try {
        console.log('Fazendo requisição de progresso...');
        // Usando URL absoluta para a Vercel
        const response = await fetch('https://verificadorv5.vercel.app/api/progress', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        if (!data) {
            throw new Error('Nenhum dado recebido do servidor');
        }
        
        self.postMessage(data);
    } catch (error) {
        console.error('Erro na verificação:', error);
        clearInterval(progressInterval); // Para o intervalo em caso de erro
        self.postMessage({ 
            error: error.message || 'Erro ao verificar progresso',
            details: error.stack || 'Detalhes não disponíveis'
        });
    }
}

self.onerror = function(error) {
    console.error('Erro no Worker:', error);
    clearInterval(progressInterval); // Para o intervalo em caso de erro
    self.postMessage({ 
        error: error.message || 'Erro interno no Worker',
        details: 'Erro interno durante o processamento'
    });
}; 