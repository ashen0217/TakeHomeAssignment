// Configuration settings for the SOCKS5 proxy server
module.exports = {
    // Server listening port (default: 8088, or 8888 if ADMIN_OVERRIDE is set)
    port: process.env.PROXY_PORT || (process.env.ADMIN_OVERRIDE ? 8888 : 8088),
    
    // Server host to bind to (default: 0.0.0.0 to accept all connections)
    host: '0.0.0.0',
    
    // Authentication credentials
    auth: {
        username: process.env.PROXY_USERNAME || 'proxyuser',
        password: process.env.PROXY_PASSWORD || 'proxypass'
    },
    
    // Logging options
    logging: {
        enabled: true,
        logConnections: true,
        debug: true  // Enable debug logging
    }
};