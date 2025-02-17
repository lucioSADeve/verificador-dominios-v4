const config = {
    api: {
        baseUrl: 'https://registro.br/v2/ajax/avail/raw',  // Esta é a URL correta do registro.br
        requestDelay: 2000 // Aumentado para 2 segundos
    },
    server: {
        port: process.env.PORT || 3000
    },
    // Configuração para armazenamento temporário na Vercel
    tempStorage: '/tmp',
    dolphin: {
        apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMWFmMGFkZjQ5ZGMxNjkwZWQzMTJmMDgxNTVmYjcwZDUxMzJjYjM3Nzc1MDg2ZWE1Y2IwNmE1MjQ2MjdhYzA4MGMxOTM4ZWRiZTk5NGQ5OTgiLCJpYXQiOjE3Mzk4MzQ1NzcuODIwNzcxLCJuYmYiOjE3Mzk4MzQ1NzcuODIwNzczLCJleHAiOjE3NDI0MjY1NzcuODExNDI2LCJzdWIiOiIyMzQ0MTQxIiwic2NvcGVzIjpbXX0.HneGxZ8wXbRcZnZVf_Rh82-qNt-trdYJYTKQG28zU6xP_8GxUSX8bpRPEe-MPj0qav-QqTB4AnFJqPlgsttjNK9U4mOWne9EXrMMsWJQ_hSTANoEp0wtPJ-QN2-GvDm9n1B_E-W1IeTGT7nZQEKonRdbKjlvhGx-Ca5lM9wPaZPoimXmzIjWaIFHPIEAV1k9oeNlVMPVYyWb-TI55fR6wOTqwFVzL3oTuij2oZ0HpXxP0RmgD039_b0-rLRb_PVtmmhLQ66fsssjHJloJeLtZhE9woaL7UicIWBK88i0gxvfnwuu9N-lYhKA18Fl2s2FUBfoIx6sjy-tJBjaAHllx1u5MPRUamV2QwDNvKVuKCm3PCBxq-ZPaEYmXcpA1o9FLkJ5suGyrd7YkXhAPYeQ0tDjkqLKlo3zbouclsfljM3pc7RwuX3ynPIwXvyv9Z6EZnYi5Sl_cPDZOB_ruPeb0NqNbtjRkecFSr7FPz5SodjmhD50oUYwxj_3yFSNjG7gHXN-NWgyT3XHRRjaRjOwvzZt6xA8hu9akoZlqgBvsnWnxhhuaRv5OAoqvEP4F9wUJMdf0HIyBt0tI_wgBnhBS_0dpf1t96lLnLeE3Lq2ebc9aVJWd0P0AcUwv0fhcjwTjZ2_Qfl3YsXhmFRceZOujK4HBZqOD-T8cZgw3aOlIe4',
        baseUrl: 'http://localhost:3001',  // URL da documentação
    },
};

module.exports = config;