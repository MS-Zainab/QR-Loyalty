
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const loyaltyRoutes = require('./routes/loyaltyRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const qrRoutes = require('./routes/qrRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const customerRoutes = require('./routes/customerRoutes');
const stampRoutes = require('./routes/stampRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const staffRoutes = require('./routes/staffRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { createRateLimiter, requestIdentity } = require('./middleware/rateLimit');


const express = require('express');
const cors = require('cors');

// require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;
app.set('etag', false);

if (process.env.NODE_ENV === 'production') {
  // Render terminates TLS at its trusted reverse proxy.
  app.set('trust proxy', 1);
}

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const productionOrigins = new Set(configuredOrigins);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!req.path.startsWith('/api-docs')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
  }

  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const isLocalDevelopmentOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
      const isAllowedProductionOrigin =
        process.env.NODE_ENV === 'production' && productionOrigins.has(origin);

      return callback(null, isLocalDevelopmentOrigin || isAllowedProductionOrigin);
    }
  })
);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(
  '/api',
  createRateLimiter({
    limit: 120,
    windowMs: 60_000,
    keyFor: requestIdentity
  })
);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stamps', stampRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);


app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'QR Loyalty backend is running'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = Number(error.status || error.statusCode);
  const isOversizedBody = status === 413 || error.type === 'entity.too.large';
  const isMalformedBody = status === 400 && error.type === 'entity.parse.failed';

  console.error('Unhandled request error:', {
    method: req.method,
    path: req.path,
    status: isOversizedBody ? 413 : isMalformedBody ? 400 : 500,
    name: error.name,
    code: error.code
  });

  return res.status(isOversizedBody ? 413 : isMalformedBody ? 400 : 500).json({
    success: false,
    message: isOversizedBody
      ? 'Request body is too large'
      : isMalformedBody
        ? 'Request body must be valid JSON'
        : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`QR Loyalty backend running on http://localhost:${PORT}`);
});
