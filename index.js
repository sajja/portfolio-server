const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`POST ${req.originalUrl} body:`, req.body);
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Routers
app.use('/api/v1/portfolio', require('./portfolio'));
app.use('/api/v1/companies', require('./companies'));
app.use('/api/v1/expense', require('./expenses'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
