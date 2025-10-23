#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run with: node generate-secrets.js
 */

const crypto = require('crypto');

console.log('🔐 Generating secure secrets for production deployment...\n');

// Generate JWT secret (64 bytes = 128 hex characters)
const jwtSecret = crypto.randomBytes(64).toString('hex');

// Generate session secret (32 bytes = 64 hex characters)
const sessionSecret = crypto.randomBytes(32).toString('hex');

// Generate API key for internal services (if needed)
const apiSecret = crypto.randomBytes(32).toString('hex');

console.log('Copy these to your Render dashboard Environment Variables:');
console.log('=' .repeat(60));
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`API_SECRET=${apiSecret}`);
console.log('=' .repeat(60));

console.log('\n✅ Secrets generated successfully!');
console.log('⚠️  IMPORTANT: Never commit these secrets to version control');
console.log('📝 Copy each variable to your Render dashboard under "Environment Variables"');
console.log('🔄 Rotate these secrets regularly for security');

console.log('\n🛠️  Other recommended steps:');
console.log('1. Set up MongoDB Atlas with IP whitelist (0.0.0.0/0 for Render)');
console.log('2. Create Redis instance (Redis Cloud or Upstash)');
console.log('3. Update CORS_ORIGIN with your frontend domain');
console.log('4. Configure health checks in Render to use /health endpoint');

// Additional security recommendations
console.log('\n🔒 Security recommendations:');
console.log('- Enable MongoDB authentication and use strong passwords');
console.log('- Use Redis AUTH and strong passwords');
console.log('- Regularly update dependencies (npm audit fix)');
console.log('- Monitor logs for suspicious activity');
console.log('- Set up alerts for failed authentication attempts');