const express = require('express');
const app = require('../server/index.js');

const vercelApp = express();

// Ensure the request path has /api for Express routing
vercelApp.use((req, res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  next();
});

vercelApp.use(app);

module.exports = vercelApp;
