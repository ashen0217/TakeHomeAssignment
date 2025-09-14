# SOCKS5 Proxy Server

A simple SOCKS5 proxy server implementation in Node.js that supports username/password authentication and basic TCP tunneling.

## Features

- SOCKS5 protocol implementation
- Username/password authentication
- TCP tunneling support
- Connection logging (source IP, destination host/port)
- Configurable via environment variables

## Setup

1. Ensure you have Node.js installed (v12 or higher recommended)

2. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

The proxy server can be configured using environment variables:

- `PROXY_PORT` - Port to listen on (default: 1080)
- `PROXY_USERNAME` - Authentication username (default: proxyuser)
- `PROXY_PASSWORD` - Authentication password (default: proxypass)

## Running the Server

Start the server:

```bash
node src/server.js
```

## Testing the Proxy

You can test the proxy using curl. Here's an example that fetches your IP information through the proxy:

```bash
curl -x socks5://proxyuser:proxypass@localhost:1080 https://ipinfo.io
```

## Implementation Notes

### What I Had to Learn

- Deep dive into the SOCKS5 protocol specification (RFC 1928)
- Understanding binary protocols and buffer manipulation in Node.js
- Handling asynchronous network operations and error cases
- Implementing authentication mechanisms (RFC 1929)

### Debugging Approach

- Used extensive logging to track the flow of connections
- Implemented step-by-step protocol handling with error checking
- Tested with various SOCKS5 clients to ensure compatibility
- Used Wireshark for packet analysis when needed

### Potential Improvements

With more time, I would:

- Add support for BIND and UDP ASSOCIATE commands
- Implement IPv6 address type support
- Add connection timeouts and rate limiting
- Create a more robust configuration system
- Add unit tests and integration tests
- Implement better error handling and recovery
- Add support for multiple authentication methods