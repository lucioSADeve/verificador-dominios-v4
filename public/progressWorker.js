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
        const response = await fetch('/api/progress', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            credentials: 'same-origin'
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
        self.postMessage({ 
            error: `Erro ao verificar progresso: ${error.message}`,
            details: error.stack
        });
    }
}

self.onerror = function(error) {
    console.error('Erro no Worker:', error);
    self.postMessage({ 
        error: 'Erro interno no Worker',
        details: error.message
    });
}; 