let progressInterval;

console.log('Worker iniciado');

self.onmessage = function(e) {
    console.log('Mensagem recebida no Worker:', e.data);
    
    if (e.data === 'start') {
        console.log('Iniciando intervalo de verificação');
        checkProgress(); // Chama imediatamente pela primeira vez
        progressInterval = setInterval(checkProgress, 2000);
    } else if (e.data === 'stop') {
        console.log('Parando intervalo de verificação');
        clearInterval(progressInterval);
    }
};

async function checkProgress() {
    try {
        console.log('Verificando progresso...');
        const response = await fetch('https://verificadorv5.vercel.app/api/progress', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dados de progresso:', data);
        
        if (!data) {
            throw new Error('Dados de progresso inválidos');
        }
        
        self.postMessage(data);
    } catch (error) {
        console.error('Erro ao verificar progresso:', error);
        self.postMessage({ error: error.message });
        clearInterval(progressInterval);
    }
}

self.onerror = function(error) {
    console.error('Erro no Worker:', error);
    self.postMessage({ error: error.message });
    clearInterval(progressInterval);
}; 