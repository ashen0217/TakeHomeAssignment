const config = require('./config');

class Logger {
    info(message) {
        if (config.logging.enabled) {
            console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
        }
    }

    error(message) {
        if (config.logging.enabled) {
            console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
        }
    }

    connection(sourceIP, destHost, destPort) {
        if (config.logging.enabled && config.logging.logConnections) {
            this.info(`Connection: ${sourceIP} -> ${destHost}:${destPort}`);
        }
    }
}

function createLogger() {
    return new Logger();
}

module.exports = { createLogger };