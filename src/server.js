const net = require('net');
const config = require('./config');
const { createLogger } = require('./logger');
const { handleSocksHandshake } = require('./socks5');

const logger = createLogger();

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection:', err);
    process.exit(1);
});

// Create the proxy server
// Check if running with admin privileges on Windows
if (process.platform === 'win32' && !process.env.ADMIN_OVERRIDE) {
    logger.error('On Windows, this server requires administrative privileges.');
    logger.error('Please:');
    logger.error('1. Right-click Command Prompt or PowerShell');
    logger.error('2. Select "Run as administrator"');
    logger.error('3. Navigate to the project directory');
    logger.error('4. Run the server again');
    logger.error('');
    logger.error('Alternatively, set ADMIN_OVERRIDE=1 to run on a high port (>1024) without admin rights');
    process.exit(1);
}

// Create server with explicit error handlers
let server;
try {
    server = net.createServer((socket) => {
        logger.info('Raw connection received');
    });
    
    // Add error handler for server creation
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`Port ${config.port} is already in use`);
        } else if (err.code === 'EACCES') {
            logger.error(`Permission denied to bind to port ${config.port}. Try running as administrator.`);
        } else {
            logger.error(`Server creation error: ${err.message}`);
        }
        process.exit(1);
    });
} catch (err) {
    logger.error(`Failed to create server: ${err.message}`);
    process.exit(1);
}

server.on('connection', async (clientSocket) => {
    const clientInfo = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`;
    logger.info(`New connection from ${clientInfo}`);

    // Set encoding to handle raw binary data
    clientSocket.setNoDelay(true);

    clientSocket.on('data', (data) => {
        logger.info(`Received data from ${clientInfo}: ${data.toString('hex')}`);
    });

    clientSocket.on('error', (err) => {
        logger.error(`Socket error from ${clientInfo}: ${err.message}`);
        clientSocket.destroy();
    });

    clientSocket.on('end', () => {
        logger.info(`Connection ended from ${clientInfo}`);
    });

    try {
        await handleSocksHandshake(clientSocket, logger);
    } catch (err) {
        logger.error(`Handshake error: ${err.message}`);
        clientSocket.destroy();
    }
});

server.on('error', (err) => {
    logger.error(`Server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Please choose a different port.`);
        process.exit(1);
    }
});

// Start the server
server.listen(config.port, config.host, () => {
    logger.info(`SOCKS5 proxy server listening on ${config.host}:${config.port}`);
    if (config.logging.debug) {
        logger.info('Debug mode enabled');
    }
});