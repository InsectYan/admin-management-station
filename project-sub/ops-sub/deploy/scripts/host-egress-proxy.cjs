#!/usr/bin/env node
/**
 * Host-side HTTPS CONNECT proxy for Docker→Aliyun.
 * Must run on Windows host (not in container) so TLS uses the host network stack.
 *
 * Only CONNECT is supported for tunneling. Plain HTTP GET to non-health paths
 * returns 405 — avoids axios+HTTPS_PROXY accidentally treating the health
 * banner as a successful registry JSON body.
 */
const http = require('http');
const net = require('net');

const PORT = Number(process.env.OPS_HOST_EGRESS_PORT || 1328);
const HOST = process.env.OPS_HOST_EGRESS_BIND || '0.0.0.0';

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/' || url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ams-ops host egress proxy (CONNECT only)\n');
    return;
  }
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end(
    'This proxy only supports HTTPS CONNECT tunnels. ' +
    'Do not set HTTPS_PROXY for clients that already use hostEgressAgent.\n',
  );
});

server.on('connect', (req, clientSocket, head) => {
  const [hostname, portStr] = String(req.url || '').split(':');
  const port = Number(portStr) || 443;
  if (!hostname) {
    clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    clientSocket.end();
    return;
  }
  const started = Date.now();
  const serverSocket = net.connect(port, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  serverSocket.on('error', (err) => {
    try {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    } catch (_) {}
    clientSocket.end();
    console.error('[egress] connect fail', hostname, port, err.message, Date.now() - started + 'ms');
  });
  clientSocket.on('error', () => serverSocket.destroy());
});

server.listen(PORT, HOST, () => {
  console.log(`[ams-ops-egress] CONNECT proxy on ${HOST}:${PORT}`);
});
