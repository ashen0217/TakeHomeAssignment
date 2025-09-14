const net = require('net');

const USERNAME = 'proxyuser';
const PASSWORD = 'proxypass';
const TARGET_HOST = 'example.com';
const TARGET_PORT = 80;

function formatHex(buffer) {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function debug(msg, data) {
    if (data) {
        console.log(`${msg} [${formatHex(data)}]`);
    } else {
        console.log(msg);
    }
}

console.log('Attempting to connect to proxy server...');
const socket = net.createConnection({
    host: '127.0.0.1',
    port: 8888,
    // Add connection timeout
    timeout: 5000
}, () => {
    debug('Connected to proxy server');
    sendInitialHandshake();
});

function sendInitialHandshake() {
    const handshake = Buffer.from([
        0x05, // SOCKS version
        0x01, // Number of authentication methods
        0x02  // Username/password authentication
    ]);
    debug('Sending initial handshake', handshake);
    socket.write(handshake);
}

function sendAuthentication() {
    const usernameBytes = Buffer.from(USERNAME);
    const passwordBytes = Buffer.from(PASSWORD);
    
    const authRequest = Buffer.alloc(3 + usernameBytes.length + passwordBytes.length);
    authRequest[0] = 0x01; // Auth version
    authRequest[1] = usernameBytes.length;
    usernameBytes.copy(authRequest, 2);
    authRequest[2 + usernameBytes.length] = passwordBytes.length;
    passwordBytes.copy(authRequest, 3 + usernameBytes.length);
    
    debug('Sending authentication request', authRequest);
    socket.write(authRequest);
}

function sendConnectRequest() {
    const targetHost = Buffer.from(TARGET_HOST);
    const request = Buffer.alloc(7 + targetHost.length);
    request[0] = 0x05; // SOCKS version
    request[1] = 0x01; // CONNECT command
    request[2] = 0x00; // Reserved
    request[3] = 0x03; // Domain name address type
    request[4] = targetHost.length;
    targetHost.copy(request, 5);
    request.writeUInt16BE(TARGET_PORT, 5 + targetHost.length);
    
    debug('Sending connect request', request);
    socket.write(request);
}

let state = 'initial';
let buffer = Buffer.alloc(0);

socket.on('data', (data) => {
    debug('Received raw data', data);
    buffer = Buffer.concat([buffer, data]);

    try {
        while (buffer.length > 0) {
            switch (state) {
                case 'initial':
                    if (buffer.length >= 2) {
                        const version = buffer[0];
                        const method = buffer[1];
                        debug(`SOCKS version: ${version}, auth method: ${method}`);
                        
                        if (version === 0x05) {
                            if (method === 0x02) {
                                debug('Server accepted username/password auth');
                                state = 'authenticating';
                                sendAuthentication();
                            } else {
                                throw new Error('Server rejected auth method');
                            }
                        } else {
                            throw new Error('Invalid SOCKS version');
                        }
                        buffer = buffer.slice(2);
                    }
                    break;

                case 'authenticating':
                    if (buffer.length >= 2) {
                        const authVersion = buffer[0];
                        const authStatus = buffer[1];
                        debug(`Auth version: ${authVersion}, status: ${authStatus}`);
                        
                        if (authVersion === 0x01) {
                            if (authStatus === 0x00) {
                                debug('Authentication successful');
                                state = 'connecting';
                                sendConnectRequest();
                            } else {
                                throw new Error('Authentication failed');
                            }
                        } else {
                            throw new Error('Invalid auth version');
                        }
                        buffer = buffer.slice(2);
                    }
                    break;

                case 'connecting':
                    if (buffer.length >= 10) {
                        if (buffer[0] === 0x05) {
                            const status = buffer[1];
                            debug(`Connect response status: ${status}`);
                            
                            if (status === 0x00) {
                                debug('Connection established');
                                state = 'connected';
                                const request = 'GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n';
                                debug('Sending HTTP request', Buffer.from(request));
                                socket.write(request);
                            } else {
                                throw new Error(`Connection failed with status: ${status}`);
                            }
                        } else {
                            throw new Error('Invalid SOCKS version in connect response');
                        }
                        buffer = buffer.slice(10);
                    }
                    break;

                case 'connected':
                    if (buffer.length > 0) {
                        debug('Received data from target:', buffer);
                        const response = buffer.toString();
                        console.log('\nHTTP Response:', response);
                        buffer = Buffer.alloc(0);
                        socket.end();
                    }
                    break;
            }
        }
    } catch (err) {
        console.error('Protocol error:', err.message);
        socket.destroy();
    }
});

socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    console.error('Error details:', err);
});

socket.on('end', () => {
    debug('Connection closed');
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});