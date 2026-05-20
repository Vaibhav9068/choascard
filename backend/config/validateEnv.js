const required = {
  all: ['MONGO_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'],
  production: [
    'CLIENT_URL',
  ],
};

const validateEnv = () => {
  const missing = required.all.filter((key) => !process.env[key]);

  if (process.env.NODE_ENV === 'production') {
    missing.push(...required.production.filter((key) => !process.env[key]));
  }

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}`
    );
    console.error('Copy backend/.env.example to backend/.env and fill in values.');
    process.exit(1);
  }
};

module.exports = validateEnv;
