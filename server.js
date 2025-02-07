const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const domainQueue = require('./domainQueue');
const fs = require('fs');

const app = express();

// Configuração do Multer para memória
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        // Aceita apenas arquivos Excel
        if (file.mimetype.includes('spreadsheet') || 
            file.mimetype.includes('excel') ||
            file.originalname.match(/\.(xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos Excel são permitidos!'));
        }
    }
});

// Certifica que a pasta uploads existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use(express.static('public'));
app.use(express.json());

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para upload do arquivo Excel
app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    console.log('Iniciando upload...');
    
    if (!req.file) {
        console.log('Nenhum arquivo recebido');
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    try {
        console.log('Processando arquivo:', req.file.originalname);
        
        const workbook = XLSX.readFile(req.file.path);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        const data = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: true
        });

        console.log('Dados brutos:', data);

        // Filtra e mantém os dados da coluna A junto com o domínio
        const domains = data
            .filter(row => row[1] && row[1].toString().trim()) // Verifica se tem domínio na coluna B
            .map(row => ({
                colA: (row[0] || '').toString().trim(), // Coluna A
                domain: row[1].toString().trim().toLowerCase() // Coluna B (domínio)
            }))
            .filter(item => item.domain.endsWith('.br') || item.domain.endsWith('.com.br'));

        console.log('Domínios para verificar:', domains);

        // Limpa o arquivo após processamento
        if (req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Erro ao limpar arquivo:', e);
            }
        }

        if (domains.length === 0) {
            throw new Error('Nenhum domínio .br ou .com.br encontrado na coluna B');
        }

        domainQueue.addDomains(domains);
        
        res.json({ 
            message: `${domains.length} domínios adicionados à fila`,
            totalDomains: domains.length
        });
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Erro ao limpar arquivo:', e);
            }
        }
        res.status(500).json({ 
            error: 'Erro ao processar arquivo',
            details: error.message 
        });
    }
});

// Rota para verificar progresso
app.get('/api/progress', (req, res) => {
    const progress = domainQueue.getProgress();
    console.log('Progresso atual:', progress);
    res.json(progress);
});

// Rota para baixar resultados
app.get('/api/download-results', (req, res) => {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(
            domainQueue.results.available.map(item => ({
                'Coluna A': item.colA,
                'Dominio': item.domain
            }))
        );
        
        XLSX.utils.book_append_sheet(wb, ws, "Dominios Disponíveis");
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="dominios_disponiveis.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao gerar arquivo:', error);
        res.status(500).json({ error: 'Erro ao baixar resultados' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});