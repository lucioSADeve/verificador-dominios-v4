let progressInterval;

self.onmessage = function(e) {
    if (e.data === 'start') {
        progressInterval = setInterval(checkProgress, 2000);
    } else if (e.data === 'stop') {
        clearInterval(progressInterval);
    }
};

async function checkProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        self.postMessage(data);
    } catch (error) {
        self.postMessage({ error: error.message });
        clearInterval(progressInterval);
    }
} 