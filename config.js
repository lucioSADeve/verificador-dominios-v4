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
        apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZWVjNTA5YjQ0ZGJmYjdjOTNkYWEyZDY0MzU5OTJmNGVmODZiMTcyMTdiODZmMGFlNzI0NzdiMGY1M2ZlZDAwMDg3ZDNhMDc4YzdhZTIwMWYiLCJpYXQiOjE3Mzk4MzU4MzMuMzQ5MDI5LCJuYmYiOjE3Mzk4MzU4MzMuMzQ5MDMxLCJleHAiOjE3NzEzNzE4MzMuMzQxNzk0LCJzdWIiOiIyMzQ0MTQxIiwic2NvcGVzIjpbXX0.uVTnAdKaAR-ae5tGK4Qlp-hBNoUX4JYUBmjA1_4yk2WXgIv72H7G9s5sCUmINOb62BJuSYlBKxFTsBan2pvcQ0e_o1bWn8Nn_vUu5hmDrJ3ikt3PLgPB_QPIeIrJCaAaXTLPvcGKP_Slk9Bt6z0VDVaAkIMbWepDsOAQ7W3sMXsFa73K-iF2R1RfV7D3mRLWPGcChNmMerX4KBvFsR2aOqBseIR2IoI8mMoZTquu8caTaFioxuQoHAHKEazEYYx_lAQvGkJo6THJKHOF7kkZqDbiFhJsVBUX4KxMuSUqVEnOstsjP0WNklFWEDOhpWnCd4wKMgpkzQl6sVk3rWSG_OyypIGES-Qb2_EidVTEvZsvqD0xxIek5gjwPEdiDaU3BWiJvCYixsNqj-aWVhZWrtgHrPbhf-FpE63UipitzyBUV3n6jhIshzaCyV2SxPM32ZPF2n-oUS3QjPQby_Y6Ikn26oF-HwgJf0GLxDwSdOGr4qfW45e0Qx1yi2pdNEMTj2abUqu5rihRchuA9XmCFtMedszkufrP1BA4u8G0kAw2ZE6RIlz91DoIWdEs4eCrnGtPTjQd29EDAANwhv39k37ZzMnPSm0elPX0sVQiao2PS5B8ZIfpYoAmgdFIDusKVbxB2f97E49JytDxzVHTNjZt9gqCQz6e5fjZo0NjsK0',
        baseUrl: 'https://app.dolphin-anty-api.com/api/v1',  // URL atualizada
    },
};

module.exports = config;