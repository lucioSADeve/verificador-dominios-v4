const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const domainQueue = require('./domainQueue');
const { Worker } = require('worker_threads');
const os = require('os');
const cors = require('cors');

const app = express();

// Adicione esta configuração do CORS logo após criar o app
app.use(cors({
    origin: ['https://verificador-dominios-v4.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

// Configuração para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rota principal - deve vir depois do express.static
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuração otimizada para ambiente serverless
const numWorkers = process.env.VERCEL ? 2 : Math.max(4, os.cpus().length);
const BATCH_SIZE = 100;
const workers = new Map();
const CONCURRENT_CHECKS = 25;

// Configuração otimizada do Multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
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

// Cache em memória para resultados
const resultsCache = new Map();

// Função otimizada para processar domínios
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

            // Adiciona timeout para o worker
            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Worker timeout'));
            }, 30000); // 30 segundos de timeout

            worker.on('message', (result) => {
                clearTimeout(timeout);
                resultsCache.set(workerId, result);
                resolve(result);
                worker.terminate();
                workers.delete(workerId);
            });

            worker.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
                worker.terminate();
                workers.delete(workerId);
            });

            worker.postMessage({ 
                domains: chunk, 
                concurrent: CONCURRENT_CHECKS 
            });
        });
    });

    return Promise.all(workerPromises.map(p => p.catch(err => {
        console.error('Erro no worker:', err);
        return [];
    })));
}

// Rotas da API
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    try {
        const workbook = XLSX.read(req.file.buffer, { 
            type: 'buffer',
            cellDates: true,
            cellNF: false,
            cellText: false
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const domains = new Set(); // Usa Set para evitar duplicatas
        const range = XLSX.utils.decode_range(firstSheet['!ref']);
        
        // Otimiza a leitura do Excel
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellB = firstSheet[XLSX.utils.encode_cell({r: row, c: 1})]; // Coluna B
            const cellA = firstSheet[XLSX.utils.encode_cell({r: row, c: 0})]; // Coluna A
            
            // Verifica se a célula B tem conteúdo válido
            if (cellB && cellB.v && typeof cellB.v === 'string') {
                const domain = cellB.v.toString().trim().toLowerCase();
                // Verifica se é um domínio válido
                if (domain && (domain.endsWith('.br') || domain.endsWith('.com.br'))) {
                    domains.add({
                        colA: cellA ? cellA.v.toString().trim() : '',
                        domain: domain
                    });
                }
            }
        }

        const uniqueDomains = Array.from(domains);
        
        if (uniqueDomains.length === 0) {
            throw new Error('Nenhum domínio .br ou .com.br válido encontrado na coluna B');
        }

        console.log(`Total de domínios únicos válidos: ${uniqueDomains.length}`);

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
    ttl: 250
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

app.get('/api/download-results', (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Coluna A', 'Dominio'],
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

// Rota para limpar cache e cancelar processamento
app.post('/api/clear-cache', (req, res) => {
    try {
        // Limpa o cache e estado
        domainQueue.clearResults();
        
        // Termina todos os workers ativos
        workers.forEach(worker => {
            try {
                worker.terminate();
            } catch (error) {
                console.error('Erro ao terminar worker:', error);
            }
        });
        workers.clear();
        
        // Limpa caches adicionais
        resultsCache.clear();
        progressCache.data = null;
        progressCache.lastUpdate = 0;
        
        res.json({ 
            success: true, 
            message: 'Cache limpo e processamento cancelado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao limpar cache:', error);
        res.status(500).json({ 
            error: 'Erro ao limpar cache e cancelar processamento' 
        });
    }
});

// Configuração da porta
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} com ${numWorkers} worker(s)`);
});

server.timeout = 1800000; // 30 minutos

// Limpeza de recursos
process.on('SIGTERM', () => {
    workers.forEach(worker => worker.terminate());
    process.exit(0);
});

module.exports = app;