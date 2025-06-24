const { spawn } = require('child_process');
const os = require('os');

function startWorkers(numWorkers = 4) {
    console.log(`🚀 Starting ${numWorkers} Temporal workers for parallel processing...`);
    console.log(`⚡ Worker-to-Activity ratio: 1:1`);
    console.log(`📦 Each worker will handle exactly one activity`);
    console.log(`💼 Wallets per worker: ${Math.ceil(200 / numWorkers)}`);
    console.log('');
    
    const workers = [];
    
    for (let i = 1; i <= numWorkers; i++) {
        console.log(`🚀 Starting Worker ${i}...`);
        
        const worker = spawn('node', ['workers/wallet-worker.js', i.toString()], {
            stdio: 'inherit',
            shell: true
        });
        
        worker.on('error', (error) => {
            console.error(`❌ Worker ${i} error:`, error);
        });
        
        worker.on('exit', (code) => {
            console.log(`🎉 Worker ${i} exited with code ${code}`);
        });
        
        workers.push(worker);
    }
    
    console.log(`\n✅ All ${numWorkers} workers started!`);
    console.log(`🎯 You can now run: npm run client:${numWorkers}`);
    console.log(`📊 Or: node client/wallet-client.js ${numWorkers}`);
    console.log('\n⏹️  Press Ctrl+C to stop all workers');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping all workers...');
        workers.forEach(worker => worker.kill('SIGINT'));
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Stopping all workers...');
        workers.forEach(worker => worker.kill('SIGTERM'));
        process.exit(0);
    });
}

// Get number of workers from command line argument
const numWorkers = process.argv[2] ? parseInt(process.argv[2]) : 4;

if (isNaN(numWorkers) || numWorkers < 1) {
    console.error('❌ Please provide a valid number of workers (e.g., node scripts/start-workers.js 8)');
    process.exit(1);
}

startWorkers(numWorkers); 