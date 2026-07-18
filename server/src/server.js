require('dotenv').config();
const { buildApp } = require('./app');
const { connectDB } = require('./config/db');
const { startEscalationScheduler } = require('./services/escalationScheduler');

async function main() {
  await connectDB();
  const app = buildApp();
  const port = process.env.PORT || 4000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Caretaker24 backend listening on :${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
  startEscalationScheduler();
}

main().catch(err => { console.error('Failed to start server:', err); process.exit(1); });
