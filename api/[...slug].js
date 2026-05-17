const express = require('express');
const app = require('../server/index.js');

const vercelApp = express();

// Vercel Serverless Functions might strip the "/api" prefix from the URL
// depending on how the route is matched. We ensure it's always present
// so that our Express router handles it correctly.
vercelApp.use((req, res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  next();
});

vercelApp.use(app);

module.exports = vercelApp;
