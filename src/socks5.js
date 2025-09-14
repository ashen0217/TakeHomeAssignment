const net = require('net');
const config = require('./config');

// SOCKS5 protocol constants
const VERSION = 0x05;
const AUTHENTICATION = {
    NO_AUTH: 0x00,
    USERNAME_PASSWORD: 0x02,
    NO_ACCEPTABLE: 0xFF
};

const COMMANDS = {
    CONNECT: 0x01
};

const ADDRESS_TYPES = {
    IPv4: 0x01,
    DOMAIN: 0x03,
    IPv6: 0x04
};

const RESPONSES = {
    SUCCESS: 0x00,
    FAILURE: 0x01
};

function readBytes(socket, length) {
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        let dataHandler = null;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (dataHandler) socket.removeListener('data', dataHandler);
        };

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout reading bytes'));
        }, 5000);

        let buffer = Buffer.alloc(0);
        dataHandler = (data) => {
            buffer = Buffer.concat([buffer, data]);
            console.log('Received data:', buffer.toString('hex'));
            
            if (buffer.length >= length) {
                cleanup();
                const result = buffer.slice(0, length);
                buffer = buffer.slice(length);
                if (buffer.length > 0) {
                    // Put any excess data back
                    socket.unshift(buffer);
                }
                resolve(result);
            }
        };

        socket.on('data', dataHandler);

        socket.on('error', (err) => {
            cleanup();
            reject(err);
        });

        socket.on('end', () => {
            cleanup();
            reject(new Error('Socket ended while reading'));
        });
    });
}

async function authenticateClient(socket, logger) {
    logger.info('Starting authentication process');
    // Read authentication method selection message
    const data = await readBytes(socket, 2);
    const version = data[0];
    const methodsCount = data[1];

    logger.info(`Client version: ${version}, methods count: ${methodsCount}`);

    if (version !== VERSION) {
        logger.error(`Unsupported SOCKS version: ${version}`);
        throw new Error('Unsupported SOCKS version');
    }

    const methods = await readBytes(socket, methodsCount);
    logger.info(`Client auth methods: ${methods.toString('hex')}`);
    
    // Check if username/password authentication is supported
    if (!methods.includes(AUTHENTICATION.USERNAME_PASSWORD)) {
        socket.write(Buffer.from([VERSION, AUTHENTICATION.NO_ACCEPTABLE]));
        throw new Error('No acceptable authentication methods');
    }

    // Send authentication method choice
    socket.write(Buffer.from([VERSION, AUTHENTICATION.USERNAME_PASSWORD]));

    // Perform username/password authentication
    const auth = await readBytes(socket, 1); // Read auth version
    if (auth[0] !== 0x01) {
        throw new Error('Unsupported auth version');
    }

    const userLen = (await readBytes(socket, 1))[0];
    const username = (await readBytes(socket, userLen)).toString();
    
    const passLen = (await readBytes(socket, 1))[0];
    const password = (await readBytes(socket, passLen)).toString();

    if (username === config.auth.username && password === config.auth.password) {
        socket.write(Buffer.from([0x01, RESPONSES.SUCCESS]));
        logger.info(`Authentication successful for user: ${username}`);
        return true;
    } else {
        socket.write(Buffer.from([0x01, RESPONSES.FAILURE]));
        throw new Error('Authentication failed');
    }
}

async function handleRequest(socket, logger) {
    // Read request header
    const header = await readBytes(socket, 4);
    
    if (header[0] !== VERSION) {
        throw new Error('Invalid SOCKS version');
    }

    const command = header[1];
    const addressType = header[3];

    if (command !== COMMANDS.CONNECT) {
        throw new Error('Only CONNECT command is supported');
    }

    let targetHost, targetPort;

    switch (addressType) {
        case ADDRESS_TYPES.IPv4: {
            const addr = await readBytes(socket, 4);
            targetHost = addr.join('.');
            break;
        }
        case ADDRESS_TYPES.DOMAIN: {
            const domainLength = (await readBytes(socket, 1))[0];
            const domain = await readBytes(socket, domainLength);
            targetHost = domain.toString();
            break;
        }
        default:
            throw new Error('Unsupported address type');
    }

    const portData = await readBytes(socket, 2);
    targetPort = portData.readUInt16BE(0);

    return { targetHost, targetPort };
}

async function createConnection(targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        const targetSocket = net.createConnection(targetPort, targetHost, () => {
            resolve(targetSocket);
        });

        targetSocket.on('error', reject);
    });
}

async function handleSocksHandshake(clientSocket, logger) {
    try {
        logger.info(`Starting SOCKS5 handshake with ${clientSocket.remoteAddress}`);
        
        // Authenticate the client
        logger.info('Starting authentication process');
        await authenticateClient(clientSocket, logger);
        logger.info('Authentication successful');

        // Process the client's request
        logger.info('Processing client request');
        const { targetHost, targetPort } = await handleRequest(clientSocket, logger);
        
        logger.info(`Attempting to connect to ${targetHost}:${targetPort}`);
        logger.connection(clientSocket.remoteAddress, targetHost, targetPort);

        // Create connection to target
        const targetSocket = await createConnection(targetHost, targetPort);

        // Send success response
        const responseHeader = Buffer.alloc(10);
        responseHeader[0] = VERSION;
        responseHeader[1] = RESPONSES.SUCCESS;
        responseHeader[2] = 0x00; // Reserved
        responseHeader[3] = ADDRESS_TYPES.IPv4;
        // Fill remaining bytes with zeros (bind address and port)
        clientSocket.write(responseHeader);

        // Setup pipe between client and target
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);

        // Handle socket closures
        targetSocket.on('error', (err) => {
            logger.error(`Target connection error: ${err.message}`);
            clientSocket.destroy();
        });

        targetSocket.on('close', () => {
            clientSocket.destroy();
        });

    } catch (err) {
        logger.error(err.message);
        clientSocket.destroy();
    }
}

module.exports = { handleSocksHandshake };