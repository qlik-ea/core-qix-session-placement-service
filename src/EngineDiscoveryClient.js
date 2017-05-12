const http = require('http');
const containerized = require('containerized');

class EngineDiscoveryClient {
  static queryEngines(props) {
    return new Promise((resolve /* , reject*/) => {
      http.get({
        host: containerized() ? 'mira' : 'localhost',
        port: 9100,
        path: `/v1/query?properties=${JSON.stringify(props)}`
      }, (response) => {
        let body = '';
        response.on('data', (d) => {
          body += d;
        });
        response.on('error', (d) => {
          resolve(d);
        });
        response.on('end', () => {
          const parsed = JSON.parse(body);
          resolve(parsed);
        });
      });
    });
  }
}

module.exports = EngineDiscoveryClient;
