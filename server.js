const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const domainQueue = require('./domainQueue');
const fs = require('fs');
const { Worker } = require('worker_threads');
const os = require('os');

const app = express();

// Configuração do Multer com buffer de memória
const upload = multer({
    storage: multer.memoryStorage(), // Usa memória ao invés de disco
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite de 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('spreadsheet') || 
            file.mimetype.includes('excel') ||
            file.originalname.match(/\.(xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos Excel são permitidos!'));
        }
    }
});

app.use(express.static('public'));
app.use(express.json());

// Número de workers baseado nos CPUs disponíveis
const numWorkers = Math.max(1, os.cpus().length - 1);
const workers = new Map();

// Função para processar domínios em paralelo
async function processDomainsBatch(domains) {
    const batchSize = Math.ceil(domains.length / numWorkers);
    const workerPromises = [];

    for (let i = 0; i < numWorkers; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, domains.length);
        const domainBatch = domains.slice(start, end);

        if (domainBatch.length > 0) {
            const worker = new Worker('./domainWorker.js');
            const workerId = `worker-${i}`;
            workers.set(workerId, worker);

            workerPromises.push(
                new Promise((resolve, reject) => {
                    worker.on('message', (result) => {
                        resolve(result);
                        worker.terminate();
                        workers.delete(workerId);
                    });
                    worker.on('error', reject);
                    worker.postMessage(domainBatch);
                })
            );
        }
    }

    return Promise.all(workerPromises);
}

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para upload do arquivo Excel
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    console.log('Iniciando upload...');
    
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    try {
        console.log('Processando arquivo:', req.file.originalname);
        
        // Lê o arquivo diretamente do buffer de memória
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Otimiza a leitura do Excel
        const data = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: true,
            blankrows: false
        });

        // Otimiza o processamento dos dados
        const domains = data.reduce((acc, row) => {
            if (row[1] && typeof row[1] === 'string') {
                const domain = row[1].trim().toLowerCase();
                if (domain.endsWith('.br') || domain.endsWith('.com.br')) {
                    acc.push({
                        colA: (row[0] || '').toString().trim(),
                        domain: domain
                    });
                }
            }
            return acc;
        }, []);

        if (domains.length === 0) {
            throw new Error('Nenhum domínio .br ou .com.br encontrado na coluna B');
        }

        // Processa os domínios em lotes paralelos
        domainQueue.addDomains(domains);
        processDomainsBatch(domains).catch(console.error);
        
        res.json({ 
            message: `${domains.length} domínios adicionados à fila`,
            totalDomains: domains.length
        });
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        res.status(500).json({ 
            error: 'Erro ao processar arquivo',
            details: error.message 
        });
    }
});

// Otimiza a rota de progresso com cache
const progressCache = {
    lastUpdate: 0,
    data: null,
    ttl: 500 // 500ms de cache
};

app.get('/api/progress', (req, res) => {
    const now = Date.now();
    if (progressCache.data && (now - progressCache.lastUpdate) < progressCache.ttl) {
        return res.json(progressCache.data);
    }

    const progress = domainQueue.getProgress();
    progressCache.data = progress;
    progressCache.lastUpdate = now;
    res.json(progress);
});

// Otimiza a geração do arquivo de resultados
app.get('/api/download-results', (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(
            domainQueue.results.available.map(({ colA, domain }) => ({
                'Coluna A': colA,
                'Dominio': domain
            }))
        );
        
        XLSX.utils.book_append_sheet(wb, ws, "Dominios Disponíveis");
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="dominios_disponiveis.xlsx"');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao gerar arquivo:', error);
        res.status(500).json({ error: 'Erro ao baixar resultados' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} com ${numWorkers} workers`);
});

// Limpa workers ao encerrar
process.on('SIGTERM', () => {
    workers.forEach(worker => worker.terminate());
    process.exit(0);
});