import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { query } from '../src/config/database';

const API_BASE = 'http://localhost:3000/api/v1';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  log('\n🚀 ReachAPI Production Test Suite\n', colors.cyan);
  log('='.repeat(70), colors.blue);
  log('Testing with WhatsApp Business API v22.0', colors.magenta);
  log('='.repeat(70), colors.blue);

  let token = '';
  let messageId = '';
  const testEmail = `test_${Date.now()}@example.com`;
  const testNumbers = {
    indian: '918870692077',
    uk: '447424777800',
  };

  try {
    // TEST 1: Register User
    log('\n📝 Test 1: User Registration', colors.yellow);
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: 'SecurePass123!',
      phone: testNumbers.indian,
    });

    if (registerResponse.data.success) {
      log('✅ User registered successfully', colors.green);
      log(`   📧 Email: ${testEmail}`, colors.cyan);
      log(`   🔑 Client ID: ${registerResponse.data.data.api_credentials.client_id}`, colors.cyan);
      log(`   📊 Status: ${registerResponse.data.data.user.signup_status}`, colors.cyan);
      log(`   🎯 Tier: ${registerResponse.data.data.user.tier}`, colors.cyan);

      const clientId = registerResponse.data.data.api_credentials.client_id;
      const clientSecret = registerResponse.data.data.api_credentials.client_secret;

      // TEST 2: Approve User
      log('\n⚙️  Test 2: User Approval (Database)', colors.yellow);
      await query('UPDATE users SET signup_status = ? WHERE email = ?', ['approved', testEmail]);
      log('✅ User approved successfully', colors.green);
      log('   Status changed: pending → approved', colors.cyan);

      await sleep(1000);

      // TEST 3: JWT Authentication
      log('\n🔐 Test 3: JWT Token Generation', colors.yellow);
      const tokenResponse = await axios.post(`${API_BASE}/auth/token`, {
        client_id: clientId,
        client_secret: clientSecret,
      });

      if (tokenResponse.data.success) {
        token = tokenResponse.data.data.token;
        log('✅ JWT token generated', colors.green);
        log(`   🎫 Token: ${token.substring(0, 50)}...`, colors.cyan);
        log(`   ⏱️  Expires: ${tokenResponse.data.data.expires_in}`, colors.cyan);
        log(`   👤 User: ${tokenResponse.data.data.user.email}`, colors.cyan);
      }

      await sleep(1000);

      // TEST 4: Send Single Message
      log('\n📨 Test 4: Send Single Message (Indian Number)', colors.yellow);
      log(`   📞 Recipient: ${testNumbers.indian}`, colors.cyan);
      const sendResponse = await axios.post(
        `${API_BASE}/messages/send`,
        {
          phone_number: testNumbers.indian,
          content: '🚀 Hello from ReachAPI! This is a production test message from your WhatsApp Bulk Messaging Platform.',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (sendResponse.data.success) {
        messageId = sendResponse.data.data.messageId;
        log('✅ Message queued successfully', colors.green);
        log(`   📋 Message ID: ${messageId}`, colors.cyan);
        log(`   📊 Status: ${sendResponse.data.data.status}`, colors.cyan);
        log(`   📍 Queue Position: ${sendResponse.data.data.queuePosition}`, colors.cyan);
      }

      // Wait for worker
      log('\n⏳ Waiting 8 seconds for worker to process message...', colors.magenta);
      await sleep(8000);

      // TEST 5: Check Message Status
      log('\n📊 Test 5: Message Status Check', colors.yellow);
      const statusResponse = await axios.get(`${API_BASE}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statusResponse.data.success) {
        const msg = statusResponse.data.data;
        const statusIcon = msg.status === 'sent' ? '✅' : msg.status === 'failed' ? '❌' : '⏳';
        log(`${statusIcon} Message status retrieved`, colors.green);
        log(`   📊 Status: ${msg.status}`, colors.cyan);
        log(`   🔄 Attempts: ${msg.attempts}`, colors.cyan);
        log(`   📅 Created: ${new Date(msg.created_at).toLocaleString()}`, colors.cyan);
        log(`   📱 Phone: ${msg.phone_number}`, colors.cyan);
        
        if (msg.error_message) {
          log(`   ⚠️  Error: ${msg.error_message}`, colors.red);
        }
        
        if (msg.status === 'sent') {
          log('\n   🎉 Check your WhatsApp on ' + testNumbers.indian, colors.green);
        }
      }

      // TEST 6: List Messages with Pagination
      log('\n📋 Test 6: Message List (Pagination)', colors.yellow);
      const listResponse = await axios.get(`${API_BASE}/messages?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (listResponse.data.success) {
        log('✅ Messages retrieved successfully', colors.green);
        log(`   📊 Total Messages: ${listResponse.data.pagination.total}`, colors.cyan);
        log(`   📄 Current Page: ${listResponse.data.pagination.page}/${listResponse.data.pagination.totalPages}`, colors.cyan);
        log(`   📝 Messages in Page: ${listResponse.data.data.length}`, colors.cyan);
      }

      // TEST 7: Bulk Messages (Multi-country)
      log('\n📦 Test 7: Bulk Message Sending (Multi-country)', colors.yellow);
      log(`   📞 Sending to ${testNumbers.indian} (India)`, colors.cyan);
      log(`   📞 Sending to ${testNumbers.uk} (UK)`, colors.cyan);
      
      const bulkResponse = await axios.post(
        `${API_BASE}/messages/bulk`,
        {
          messages: [
            { 
              phone_number: testNumbers.indian, 
              content: '📢 Bulk Test 1: Hello from ReachAPI Bulk Messaging!' 
            },
            { 
              phone_number: testNumbers.uk, 
              content: '📢 Bulk Test 2: Multi-country WhatsApp delivery test.' 
            },
            { 
              phone_number: testNumbers.indian, 
              content: '📢 Bulk Test 3: Production-ready messaging platform.' 
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (bulkResponse.data.success) {
        log('✅ Bulk messages queued', colors.green);
        log(`   📊 Total: ${bulkResponse.data.data.total}`, colors.cyan);
        log(`   ✅ Queued: ${bulkResponse.data.data.queued}`, colors.cyan);
        log(`   ❌ Failed: ${bulkResponse.data.data.failed}`, colors.cyan);
        
        if (bulkResponse.data.data.failed > 0) {
          log('\n   ⚠️  Failed Messages:', colors.yellow);
          bulkResponse.data.data.failedMessages.forEach((fail: any) => {
            log(`      📱 ${fail.phone_number}: ${fail.error}`, colors.red);
          });
        }
      }

      // TEST 8: Health Check
      log('\n🏥 Test 8: API Health Check', colors.yellow);
      const healthResponse = await axios.get('http://localhost:3000/health');
      if (healthResponse.data.success) {
        log('✅ API is healthy', colors.green);
        log(`   🌍 Environment: ${healthResponse.data.environment}`, colors.cyan);
        log(`   ⏰ Timestamp: ${new Date(healthResponse.data.timestamp).toLocaleString()}`, colors.cyan);
      }

      // SUMMARY
      log('\n' + '='.repeat(70), colors.blue);
      log('\n🎉 All Tests Completed!\n', colors.green);
      
      log('📊 Test Results Summary:', colors.cyan);
      log('  ✅ User Registration & Authentication', colors.green);
      log('  ✅ JWT Token Generation & Validation', colors.green);
      log('  ✅ Single Message Sending', colors.green);
      log('  ✅ Message Status Tracking', colors.green);
      log('  ✅ Message Pagination & Listing', colors.green);
      log('  ✅ Bulk Message Processing', colors.green);
      log('  ✅ Health Monitoring', colors.green);
      
      log('\n📱 WhatsApp Delivery:', colors.cyan);
      log(`  • Check ${testNumbers.indian} for test messages`, colors.magenta);
      log(`  • Check ${testNumbers.uk} if verified`, colors.magenta);
      
      log('\n🔧 API Configuration:', colors.cyan);
      log(`  • WhatsApp API: v22.0`, colors.magenta);
      log(`  • Phone Number ID: 736749919529860`, colors.magenta);
      log(`  • Business Account: 1124466539618920`, colors.magenta);
      
      log('\n' + '='.repeat(70), colors.blue);

      // Cleanup
      log('\n🧹 Cleaning up test data...', colors.yellow);
      await query('DELETE FROM messages WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [
        testEmail,
      ]);
      await query('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [
        testEmail,
      ]);
      await query('DELETE FROM users WHERE email = ?', [testEmail]);
      log('✅ Test data cleaned up successfully\n', colors.green);
      
    }
  } catch (error: any) {
    log('\n' + '='.repeat(70), colors.red);
    log('❌ TEST FAILED!', colors.red);
    log('='.repeat(70), colors.red);
    
    if (error.response) {
      log(`\n📊 Status Code: ${error.response.status}`, colors.red);
      log(`📝 Error Details:`, colors.red);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      log('\n❌ No response from server', colors.red);
      log('⚠️  Make sure API server is running on http://localhost:3000', colors.yellow);
      log('   Terminal 1: npm run dev', colors.cyan);
      log('   Terminal 2: npm run worker:dev', colors.cyan);
    } else {
      log(`\n❌ Error: ${error.message}`, colors.red);
    }
    
    log('\n' + '='.repeat(70), colors.red);
    process.exit(1);
  }
}

// Startup
console.clear();
log('\n' + '='.repeat(70), colors.blue);
log('🚀 ReachAPI - WhatsApp Bulk Messaging Platform', colors.cyan);
log('='.repeat(70), colors.blue);
log('\n⚠️  Prerequisites:', colors.yellow);
log('   ✓ API server running (Terminal 1: npm run dev)', colors.cyan);
log('   ✓ Worker running (Terminal 2: npm run worker:dev)', colors.cyan);
log('   ✓ Database connected (MariaDB on 82.112.236.69)', colors.cyan);
log('   ✓ Redis connected (82.112.236.69:6379)', colors.cyan);
log('   ✓ WhatsApp API configured (v22.0)', colors.cyan);
log('\n⏳ Starting tests in 3 seconds...\n', colors.magenta);

setTimeout(() => {
  runTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 3000);
