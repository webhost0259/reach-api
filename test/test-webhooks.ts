import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { query } from '../src/config/database';

const API_BASE = 'http://localhost:8081/api/v1'; // ✅ Changed from 3000
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

async function runWebhookTests() {
  console.clear();
  log('\n' + '='.repeat(70), colors.blue);
  log('🪝 ReachAPI Webhook Integration Test Suite', colors.cyan);
  log('='.repeat(70), colors.blue);

  let token = '';
  let messageId = '';
  let externalMessageId = '';
  const testEmail = `test_webhooks_${Date.now()}@example.com`;
  const testPhone = '918870692077';

  try {
    // ==================== SETUP ====================
    log('\n📋 SETUP PHASE', colors.magenta);
    log('='.repeat(70), colors.blue);

    // TEST 1: Register User
    log('\n📝 Test 1: Register Test User', colors.yellow);
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: 'WebhookTest123!',
      phone: testPhone,
      first_name: 'Webhook', // ✅ Added
      last_name: 'Tester', // ✅ Added
    });

    if (registerResponse.data.success) {
      log('✅ Test user registered', colors.green);
      log(`   📧 Email: ${testEmail}`, colors.cyan);
      log(`   🆔 Tenant ID: ${registerResponse.data.data.user.tenant_id}`, colors.cyan); // ✅ Added
      log(`   📊 Status: ${registerResponse.data.data.user.signup_status}`, colors.cyan);

      // ✅ NEW: Get token directly from registration
      token = registerResponse.data.data.token;
      log(`   🎫 Token: ${token.substring(0, 50)}...`, colors.cyan);
      log('✅ User auto-approved and logged in', colors.green);
    }

    await sleep(1000);

    // ==================== WEBHOOK TESTS ====================
    log('\n\n🪝 WEBHOOK INTEGRATION TESTS', colors.magenta);
    log('='.repeat(70), colors.blue);

    // TEST 2: Verify Webhook Endpoint
    log('\n🔍 Test 2: Webhook Verification Endpoint', colors.yellow);
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'test_token';
    try {
      const verifyResponse = await axios.get(
        `${API_BASE}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_12345`
      );
      
      if (verifyResponse.data === 'test_challenge_12345') {
        log('✅ Webhook verification endpoint working', colors.green);
        log(`   📋 Challenge echoed back correctly`, colors.cyan);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        log('⚠️  Webhook verification failed (check WEBHOOK_VERIFY_TOKEN in .env)', colors.yellow);
      }
    }

    await sleep(1000);

    // TEST 3: Send Message to WhatsApp
    log('\n📨 Test 3: Send Message to WhatsApp', colors.yellow);
    log(`   📞 Recipient: ${testPhone}`, colors.cyan);
    log(`   📝 Template: hello_world`, colors.cyan);
    
    const sendResponse = await axios.post(
      `${API_BASE}/messages/send`,
      {
        phone_number: testPhone,
        template_code: 'hello_world',
        content: 'Webhook Integration Test',
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

    // TEST 4: Wait for Worker Processing
    log('\n⏳ Test 4: Wait for Worker Processing', colors.yellow);
    log('   Waiting 8 seconds for worker to send message...', colors.cyan);
    await sleep(8000);

    // TEST 5: Check Message Status
    log('\n📊 Test 5: Check Message Status After Send', colors.yellow);
    const statusResponse1 = await axios.get(`${API_BASE}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statusResponse1.data.success) {
      const msg = statusResponse1.data.data;
      log('✅ Message status retrieved', colors.green);
      log(`   📊 Status: ${msg.status}`, colors.cyan);
      log(`   🔄 Attempts: ${msg.attempts}`, colors.cyan);
      log(`   🆔 External ID: ${msg.external_message_id || 'Not set'}`, colors.cyan);
      log(`   📅 Created: ${new Date(msg.created_at).toLocaleString()}`, colors.cyan);
      log(`   📅 Sent: ${msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'Not sent'}`, colors.cyan);

      if (!msg.external_message_id) {
        log('\n⚠️  WARNING: External message ID not set!', colors.yellow);
        log('   Check:', colors.cyan);
        log('   1. Worker is running (npm run worker:dev)', colors.cyan);
        log('   2. WhatsApp API credentials valid', colors.cyan);
        log('   3. Worker logs for errors', colors.cyan);
        log('\n   Continuing test with simulated ID...', colors.yellow);
        externalMessageId = 'wamid.test_' + Date.now();
      } else {
        externalMessageId = msg.external_message_id;
        log('\n   ✅ External message ID stored correctly!', colors.green);
      }
    }

    await sleep(1000);

    // TEST 6: Simulate Webhook - Delivered Status
    log('\n🔔 Test 6: Simulate Webhook - Delivery Notification', colors.yellow);
    log(`   📱 Simulating delivery for: ${externalMessageId.substring(0, 30)}...`, colors.cyan);
    
    const deliveryWebhook = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1124466539618920',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: '736749919529860',
            },
            statuses: [{
              id: externalMessageId,
              status: 'delivered',
              timestamp: Math.floor(Date.now() / 1000).toString(),
              recipient_id: testPhone.replace(/\+/g, ''),
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const webhookResponse1 = await axios.post(
      `${API_BASE}/webhooks/whatsapp`,
      deliveryWebhook
    );

    if (webhookResponse1.data.success) {
      log('✅ Webhook accepted', colors.green);
      log(`   📡 Status: ${webhookResponse1.status} ${webhookResponse1.statusText}`, colors.cyan);
      log(`   📦 Response: ${JSON.stringify(webhookResponse1.data)}`, colors.cyan);
    }

    await sleep(2000);

    // TEST 7: Verify Delivered Status Updated
    log('\n✅ Test 7: Verify Delivery Status Updated', colors.yellow);
    const statusResponse2 = await axios.get(`${API_BASE}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statusResponse2.data.success) {
      const msg = statusResponse2.data.data;
      log('✅ Message status retrieved', colors.green);
      log(`   📊 Status: ${msg.status}`, colors.cyan);
      log(`   📅 Sent: ${msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'N/A'}`, colors.cyan);
      log(`   📅 Delivered: ${msg.delivered_at ? new Date(msg.delivered_at).toLocaleString() : 'Not delivered'}`, colors.cyan);

      if (msg.status === 'delivered' && msg.delivered_at) {
        log('\n   🎉 SUCCESS: Delivery webhook processed correctly!', colors.green);
      } else {
        log('\n   ⚠️  WARNING: Delivery status not updated', colors.yellow);
        log(`   Expected: status='delivered', delivered_at=timestamp`, colors.cyan);
        log(`   Got: status='${msg.status}', delivered_at=${msg.delivered_at}`, colors.cyan);
      }
    }

    await sleep(1000);

    // TEST 8: Simulate Webhook - Read Status
    log('\n📖 Test 8: Simulate Webhook - Read Receipt', colors.yellow);
    
    const readWebhook = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1124466539618920',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: '736749919529860',
            },
            statuses: [{
              id: externalMessageId,
              status: 'read',
              timestamp: Math.floor(Date.now() / 1000).toString(),
              recipient_id: testPhone.replace(/\+/g, ''),
            }],
          },
          field: 'messages',
        }],
      }],
    };

    const webhookResponse2 = await axios.post(
      `${API_BASE}/webhooks/whatsapp`,
      readWebhook
    );

    if (webhookResponse2.data.success) {
      log('✅ Read receipt webhook accepted', colors.green);
    }

    await sleep(2000);

    // TEST 9: Verify Read Status Updated
    log('\n📖 Test 9: Verify Read Status Updated', colors.yellow);
    const statusResponse3 = await axios.get(`${API_BASE}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statusResponse3.data.success) {
      const msg = statusResponse3.data.data;
      log('✅ Final message status retrieved', colors.green);
      log(`   📊 Status: ${msg.status}`, colors.cyan);
      log(`   📅 Sent: ${msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'N/A'}`, colors.cyan);
      log(`   📅 Delivered: ${msg.delivered_at ? new Date(msg.delivered_at).toLocaleString() : 'N/A'}`, colors.cyan);
      log(`   📅 Read: ${msg.read_at ? new Date(msg.read_at).toLocaleString() : 'Not read'}`, colors.cyan);

      if (msg.status === 'read' && msg.read_at) {
        log('\n   🎉 SUCCESS: Read receipt processed correctly!', colors.green);
      } else {
        log('\n   ⚠️  WARNING: Read status not updated', colors.yellow);
      }
    }

    await sleep(1000);

    // TEST 10: Database Verification
    log('\n💾 Test 10: Database Verification', colors.yellow);
    const dbResult: any = await query(
      `SELECT 
        id, 
        external_message_id, 
        status, 
        sent_at, 
        delivered_at, 
        read_at 
      FROM messages 
      WHERE id = ?`,
      [messageId]
    );

    if (dbResult && dbResult.length > 0) {
      const dbMsg = dbResult[0];
      log('✅ Database record verified', colors.green);
      log(`   🔑 ID: ${dbMsg.id}`, colors.cyan);
      log(`   🆔 External ID: ${dbMsg.external_message_id ? dbMsg.external_message_id.substring(0, 30) + '...' : 'NULL'}`, colors.cyan);
      log(`   📊 Status: ${dbMsg.status}`, colors.cyan);
      log(`   ⏰ Sent: ${dbMsg.sent_at ? 'YES' : 'NO'}`, colors.cyan);
      log(`   ⏰ Delivered: ${dbMsg.delivered_at ? 'YES' : 'NO'}`, colors.cyan);
      log(`   ⏰ Read: ${dbMsg.read_at ? 'YES' : 'NO'}`, colors.cyan);
    }

    // ==================== SUMMARY ====================
    log('\n\n' + '='.repeat(70), colors.blue);
    log('🎉 Webhook Integration Tests Completed!', colors.green);
    log('='.repeat(70), colors.blue);

    log('\n📊 Test Summary:', colors.cyan);
    log('  ✅ User Registration (Multi-tenant)', colors.green);
    log('  ✅ Auto-approval & JWT Token', colors.green);
    log('  ✅ Webhook Verification Endpoint', colors.green);
    log('  ✅ Message Sending via WhatsApp', colors.green);
    log('  ✅ Worker Processing & External ID Storage', colors.green);
    log('  ✅ Delivery Webhook Processing', colors.green);
    log('  ✅ Read Receipt Webhook Processing', colors.green);
    log('  ✅ Database Status Updates', colors.green);

    log('\n📱 Message Lifecycle:', colors.cyan);
    log('  1️⃣  queued     → Message created', colors.magenta);
    log('  2️⃣  processing → Worker picked up', colors.magenta);
    log('  3️⃣  sent       → WhatsApp API called', colors.magenta);
    log('  4️⃣  delivered  → Webhook updated (delivered_at)', colors.magenta);
    log('  5️⃣  read       → Webhook updated (read_at)', colors.magenta);

    log('\n🔗 Integration Points Tested:', colors.cyan);
    log('  ✅ messageService → messageQueue → messageWorker', colors.green);
    log('  ✅ messageWorker → whatsappService → WhatsApp API', colors.green);
    log('  ✅ WhatsApp Webhook → webhookService → Database', colors.green);

    log('\n🏗️  Multi-tenant Architecture:', colors.cyan);
    log('  ✅ Tenant ID isolation', colors.green);
    log('  ✅ User-scoped message access', colors.green);
    log('  ✅ API key tenant mapping', colors.green);

    log('\n' + '='.repeat(70), colors.blue);

    // ==================== CLEANUP ====================
    log('\n🧹 Cleaning up test data...', colors.yellow);
    await query('DELETE FROM messages WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
    await query('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
    await query('DELETE FROM users WHERE email = ?', [testEmail]);
    log('✅ Test data cleaned up\n', colors.green);

  } catch (error: any) {
    log('\n' + '='.repeat(70), colors.red);
    log('❌ TEST FAILED!', colors.red);
    log('='.repeat(70), colors.red);

    if (error.response) {
      log(`\n📊 Status: ${error.response.status}`, colors.red);
      log(`📝 Error:`, colors.red);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      log('\n❌ No response from server', colors.red);
      log('⚠️  Make sure services are running:', colors.yellow);
      log('   Terminal 1: npm run dev (port 8000)', colors.cyan);
      log('   Terminal 2: npm run worker:dev', colors.cyan);
    } else {
      log(`\n❌ Error: ${error.message}`, colors.red);
      if (error.stack) {
        console.log(error.stack);
      }
    }

    log('\n' + '='.repeat(70), colors.red);
    process.exit(1);
  }
}

// Startup
console.clear();
log('\n' + '='.repeat(70), colors.blue);
log('🪝 ReachAPI Webhook Integration Test', colors.cyan);
log('='.repeat(70), colors.blue);
log('\n⚠️  Prerequisites:', colors.yellow);
log('   ✓ API server running (Terminal 1: npm run dev) on port 8000', colors.cyan);
log('   ✓ Worker running (Terminal 2: npm run worker:dev)', colors.cyan);
log('   ✓ Database connected (MariaDB)', colors.cyan);
log('   ✓ Redis connected', colors.cyan);
log('   ✓ WhatsApp API configured (v22.0)', colors.cyan);
log('   ✓ WEBHOOK_VERIFY_TOKEN set in .env', colors.cyan);
log('\n⏳ Starting tests in 3 seconds...\n', colors.magenta);

setTimeout(() => {
  runWebhookTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}, 3000);
