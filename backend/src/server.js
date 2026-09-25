require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });


const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const loyaltyRoutes = require('./routes/loyaltyRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const qrRoutes = require('./routes/qrRoutes');

const express = require('express');
const cors = require('cors');

// require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/qr', qrRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'QR Loyalty backend is running'
  });
});

app.listen(PORT, () => {
  console.log(`QR Loyalty backend running on http://localhost:${PORT}`);
});