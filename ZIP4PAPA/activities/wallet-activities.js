const sqlite3 = require('sqlite3').verbose();

/**
 * Activity to process a range of wallets and add events to queue
 */
async function processWalletRange(startWallet, endWallet, workerId = 'unknown') {
    console.log(`[Worker ${workerId}] Processing wallets ${startWallet} to ${endWallet}`);
    
    // Connect to the database
    const db = new sqlite3.Database('./database/wallet_data.db');
    
    try {
        // Query wallets in the specified range
        const wallets = await queryWalletsInRange(db, startWallet, endWallet);
        
        const events = [];
        
        // Process each wallet and create events for those that need processing
        for (const wallet of wallets) {
            const walletEvents = checkWalletForEvents(wallet);
            if (walletEvents.length > 0) {
                events.push({
                    wallet_name: wallet.wallet_name,
                    events: walletEvents
                });
            }
        }
        
        console.log(`[Worker ${workerId}] Found ${events.length} wallets with events in range ${startWallet}-${endWallet}`);
        
        // Add events to queue (in a real scenario, this would be a message queue)
        await addEventsToQueue(events, workerId);
        
        return {
            workerId: workerId,
            range: `${startWallet}-${endWallet}`,
            walletsProcessed: wallets.length,
            eventsFound: events.length,
            events: events
        };
        
    } finally {
        db.close();
    }
}

/**
 * Query wallets in the specified range
 */
function queryWalletsInRange(db, startWallet, endWallet) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT wallet_name, rebalance, open_order, open_position, new_balance, check_balance
            FROM wallets 
            WHERE CAST(SUBSTR(wallet_name, 8) AS INTEGER) BETWEEN ? AND ?
            ORDER BY wallet_name
        `;
        
        db.all(query, [startWallet, endWallet], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Check if a wallet has any events that need processing
 */
function checkWalletForEvents(wallet) {
    const events = [];
    
    // Check each field and create events for 1s
    if (wallet.rebalance === 1) {
        events.push('REBALANCE_NEEDED');
    }
    
    if (wallet.open_order === 1) {
        events.push('OPEN_ORDER_DETECTED');
    }
    
    if (wallet.open_position === 1) {
        events.push('OPEN_POSITION_DETECTED');
    }
    
    if (wallet.new_balance === 1) {
        events.push('NEW_BALANCE_UPDATE');
    }
    
    if (wallet.check_balance === 1) {
        events.push('BALANCE_CHECK_REQUIRED');
    }
    
    return events;
}

/**
 * Add events to the processing queue
 */
async function addEventsToQueue(events, workerId) {
    // In a real implementation, this would add to a message queue (RabbitMQ, SQS, etc.)
    // For now, we'll just log the events
    console.log(`[Worker ${workerId}] Adding events to queue:`);
    events.forEach(event => {
        console.log(`  [Worker ${workerId}] Wallet: ${event.wallet_name}, Events: [${event.events.join(', ')}]`);
    });
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
}

module.exports = {
    processWalletRange
}; 