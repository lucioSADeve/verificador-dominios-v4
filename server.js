const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const domainQueue = require('./domainQueue');
const { Worker } = require('worker_threads');
const os = require('os');
const cluster = require('cluster');

const app = express();

// Aumenta o número de workers e otimiza o processamento
const numWorkers = Math.max(2, os.cpus().length);
const BATCH_SIZE = 50; // Processa 50 domínios por vez
const workers = new Map();
const CONCURRENT_CHECKS = 10; // Número de verificações simultâneas

// Configuração otimizada do Multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024 // Aumenta para 20MB
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

// Cache em memória para resultados
const resultsCache = new Map();

// Função otimizada para processar domínios em paralelo
async function processDomainsBatch(domains) {
    const chunks = [];
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
        chunks.push(domains.slice(i, i + BATCH_SIZE));
    }

    const workerPromises = chunks.map((chunk, index) => {
        return new Promise((resolve, reject) => {
            const worker = new Worker('./domainWorker.js');
            const workerId = `worker-${index}`;
            workers.set(workerId, worker);

            worker.on('message', (result) => {
                resultsCache.set(workerId, result);
                resolve(result);
                worker.terminate();
                workers.delete(workerId);
            });

            worker.on('error', reject);
            worker.postMessage({ domains: chunk, concurrent: CONCURRENT_CHECKS });
        });
    });

    return Promise.all(workerPromises);
}

app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    try {
        // Otimiza leitura do Excel
        const workbook = XLSX.read(req.file.buffer, { 
            type: 'buffer',
            cellDates: true,
            cellNF: false,
            cellText: false
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Processamento otimizado dos dados
        const domains = new Set(); // Usa Set para evitar duplicatas
        const range = XLSX.utils.decode_range(firstSheet['!ref']);
        
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellB = firstSheet[XLSX.utils.encode_cell({r: row, c: 1})]; // Coluna B
            const cellA = firstSheet[XLSX.utils.encode_cell({r: row, c: 0})]; // Coluna A
            
            if (cellB && cellB.v) {
                const domain = cellB.v.toString().trim().toLowerCase();
                if (domain.endsWith('.br') || domain.endsWith('.com.br')) {
                    domains.add({
                        colA: cellA ? cellA.v.toString().trim() : '',
                        domain: domain
                    });
                }
            }
        }

        const uniqueDomains = Array.from(domains);
        
        if (uniqueDomains.length === 0) {
            throw new Error('Nenhum domínio .br ou .com.br encontrado na coluna B');
        }

        // Inicia processamento em paralelo
        domainQueue.addDomains(uniqueDomains);
        processDomainsBatch(uniqueDomains).catch(console.error);
        
        res.json({ 
            message: `${uniqueDomains.length} domínios únicos adicionados à fila`,
            totalDomains: uniqueDomains.length
        });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cache otimizado para progresso
const progressCache = {
    lastUpdate: 0,
    data: null,
    ttl: 250 // Reduz para 250ms
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

// Download otimizado
app.get('/api/download-results', (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Coluna A', 'Dominio'], // Headers
            ...domainQueue.results.available.map(({ colA, domain }) => [colA, domain])
        ]);
        
        XLSX.utils.book_append_sheet(wb, ws, "Dominios Disponíveis");
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="dominios_disponiveis.xlsx"');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
        res.send(buffer);
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: 'Erro ao baixar resultados' });
    }
});

if (cluster.isMaster) {
    console.log(`Master ${process.pid} iniciando`);
    
    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} morreu. Reiniciando...`);
        cluster.fork();
    });
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} rodando na porta ${PORT}`);
    });
}

// Limpeza de recursos
process.on('SIGTERM', () => {
    workers.forEach(worker => worker.terminate());
    process.exit(0);
});