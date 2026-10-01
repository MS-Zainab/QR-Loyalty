const windows = new Map();
let lastCleanup = Date.now();

const createRateLimiter = ({ limit, windowMs, keyFor }) =>
  (req, res, next) => {
    const now = Date.now();
    const keys = [keyFor(req) || req.ip || 'unknown']
      .flat()
      .filter(Boolean)
      .map((identity) => `${req.baseUrl}${req.path}:${identity}`);
    const entries = keys.map((key) => {
      let entry = windows.get(key);
      if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return entry;
    });

    if (now - lastCleanup > 60_000) {
      for (const [storedKey, storedEntry] of windows) {
        if (storedEntry.resetAt <= now) windows.delete(storedKey);
      }
      lastCleanup = now;
    }

    const remaining = Math.min(
      ...entries.map((entry) => Math.max(limit - entry.count, 0))
    );
    const resetAt = Math.max(...entries.map((entry) => entry.resetAt));
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader(
      'RateLimit-Reset',
      String(Math.ceil(resetAt / 1000))
    );

    if (entries.some((entry) => entry.count > limit)) {
      res.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((resetAt - now) / 1000)))
      );
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    return next();
  };

const requestIdentity = (req) => req.ip || 'unknown';

module.exports = {
  createRateLimiter,
  requestIdentity
};
