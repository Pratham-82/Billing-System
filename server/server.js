require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const itemRoutes = require('./routes/items');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
const seedAdmin = require('./utils/seedAdmin');
const migratePaymentsToCustomer = require('./utils/migration');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wallpaper_billing';

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Wallpaper billing API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api/items', requireAuth, itemRoutes);

// Serve client static assets and handle client-side routing fallback
const path = require('path');
const fs = require('fs');

const clientDistPath = path.join(__dirname, '../client/dist');
const clientIndexHtml = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(clientIndexHtml);
  });
} else {
  app.get('*', (req, res) => {
    res.send('API server is running. Client build (dist) not found. Run "npm run build" in the client folder.');
  });
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Run payments migration
    await migratePaymentsToCustomer();
    // Seed initial superuser account
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });
