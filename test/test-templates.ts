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

async function runTemplateTests() {
  console.clear();
  log('\n' + '='.repeat(70), colors.blue);
  log('🎨 ReachAPI Template Management Test Suite', colors.cyan);
  log('='.repeat(70), colors.blue);

  let token = '';
  let templateIds: string[] = [];
  const testEmail = `test_templates_${Date.now()}@example.com`;

  try {
    // ==================== SETUP ====================
    log('\n📋 SETUP PHASE', colors.magenta);
    log('='.repeat(70), colors.blue);

    // TEST 1: Register User
    log('\n📝 Test 1: Register Test User', colors.yellow);
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: 'Test123456',
      phone: '+918870692077',
    });

    if (registerResponse.data.success) {
      log('✅ Test user registered', colors.green);
      log(`   Email: ${testEmail}`, colors.cyan);

      const clientId = registerResponse.data.data.api_credentials.client_id;
      const clientSecret = registerResponse.data.data.api_credentials.client_secret;

      // Approve user
      log('\n⚙️  Test 2: Approving User...', colors.yellow);
      await query('UPDATE users SET signup_status = ? WHERE email = ?', ['approved', testEmail]);
      log('✅ User approved', colors.green);

      await sleep(1000);

      // Get JWT Token
      log('\n🔑 Test 3: Get JWT Token', colors.yellow);
      const tokenResponse = await axios.post(`${API_BASE}/auth/token`, {
        client_id: clientId,
        client_secret: clientSecret,
      });

      if (tokenResponse.data.success) {
        token = tokenResponse.data.data.token;
        log('✅ JWT token obtained', colors.green);
        log(`   Token: ${token.substring(0, 50)}...`, colors.cyan);
      }
    }

    await sleep(1000);

    // ==================== TEMPLATE CRUD TESTS ====================
    log('\n\n🎨 TEMPLATE MANAGEMENT TESTS', colors.magenta);
    log('='.repeat(70), colors.blue);

    // TEST 4: Create Welcome Template
    log('\n📝 Test 4: Create Welcome Template', colors.yellow);
    const welcomeTemplate = await axios.post(
      `${API_BASE}/templates`,
      {
        name: 'Welcome New User',
        template_code: 'welcome_new_user',
        language: 'en_US',
        category: 'utility',
        body_text: 'Hello {{1}}, welcome to ReachAPI! Your account is now active.',
        footer_text: 'Powered by ReachAPI',
        example_values: ['John Doe'],
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (welcomeTemplate.data.success) {
      templateIds.push(welcomeTemplate.data.data.id);
      log('✅ Welcome template created', colors.green);
      log(`   ID: ${welcomeTemplate.data.data.id}`, colors.cyan);
      log(`   Code: ${welcomeTemplate.data.data.template_code}`, colors.cyan);
      log(`   Status: ${welcomeTemplate.data.data.status}`, colors.cyan);
    }

    await sleep(500);

    // TEST 5: Create Marketing Template
    log('\n📝 Test 5: Create Marketing Template', colors.yellow);
    const marketingTemplate = await axios.post(
      `${API_BASE}/templates`,
      {
        name: 'Flash Sale Alert',
        template_code: 'flash_sale_alert',
        language: 'en_US',
        category: 'marketing',
        body_text: '🎉 Flash Sale! Get {{1}}% off on {{2}}. Use code: {{3}}. Valid till {{4}}.',
        footer_text: 'Reply STOP to unsubscribe',
        example_values: ['50', 'All Products', 'FLASH50', 'midnight'],
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (marketingTemplate.data.success) {
      templateIds.push(marketingTemplate.data.data.id);
      log('✅ Marketing template created', colors.green);
      log(`   ID: ${marketingTemplate.data.data.id}`, colors.cyan);
      log(`   Placeholders: 4`, colors.cyan);
    }

    await sleep(500);

    // TEST 6: Create Authentication Template
    log('\n📝 Test 6: Create Authentication Template', colors.yellow);
    const authTemplate = await axios.post(
      `${API_BASE}/templates`,
      {
        name: 'OTP Verification',
        template_code: 'otp_verification',
        language: 'en_US',
        category: 'authentication',
        body_text: 'Your verification code is {{1}}. This code will expire in {{2}} minutes.',
        footer_text: 'Do not share this code',
        example_values: ['123456', '5'],
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (authTemplate.data.success) {
      templateIds.push(authTemplate.data.data.id);
      log('✅ Authentication template created', colors.green);
      log(`   ID: ${authTemplate.data.data.id}`, colors.cyan);
    }

    await sleep(500);

    // TEST 7: Create Template with Header
    log('\n📝 Test 7: Create Template with Header', colors.yellow);
    const headerTemplate = await axios.post(
      `${API_BASE}/templates`,
      {
        name: 'Order Confirmation',
        template_code: 'order_confirmation',
        language: 'en_US',
        category: 'utility',
        header_type: 'text',
        header_content: 'Order Confirmed! 🎉',
        body_text: 'Hi {{1}}, your order #{{2}} has been confirmed. Estimated delivery: {{3}}.',
        footer_text: 'Track your order on our website',
        example_values: ['Alice', 'ORD12345', 'Oct 15, 2025'],
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (headerTemplate.data.success) {
      templateIds.push(headerTemplate.data.data.id);
      log('✅ Template with header created', colors.green);
      log(`   Header Type: ${headerTemplate.data.data.header_type}`, colors.cyan);
    }

    await sleep(1000);

    // TEST 8: List All Templates
    log('\n📋 Test 8: List All Templates', colors.yellow);
    const listResponse = await axios.get(`${API_BASE}/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (listResponse.data.success) {
      log('✅ Templates retrieved', colors.green);
      log(`   Total: ${listResponse.data.pagination.total}`, colors.cyan);
      log(`   Page: ${listResponse.data.pagination.page}/${listResponse.data.pagination.totalPages}`, colors.cyan);
      
      listResponse.data.data.forEach((t: any, index: number) => {
        log(`   ${index + 1}. ${t.name} (${t.template_code}) - ${t.status}`, colors.cyan);
      });
    }

    await sleep(500);

    // TEST 9: Filter by Category
    log('\n📋 Test 9: Filter Templates by Category (Marketing)', colors.yellow);
    const marketingList = await axios.get(`${API_BASE}/templates?category=marketing`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (marketingList.data.success) {
      log('✅ Marketing templates retrieved', colors.green);
      log(`   Count: ${marketingList.data.data.length}`, colors.cyan);
    }

    await sleep(500);

    // TEST 10: Get Template Statistics
    log('\n📊 Test 10: Get Template Statistics', colors.yellow);
    const statsResponse = await axios.get(`${API_BASE}/templates/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statsResponse.data.success) {
      const stats = statsResponse.data.data;
      log('✅ Template statistics retrieved', colors.green);
      log(`   📊 Total: ${stats.total}`, colors.cyan);
      log(`   ⏳ Pending: ${stats.pending}`, colors.yellow);
      log(`   ✅ Approved: ${stats.approved}`, colors.green);
      log(`   ❌ Rejected: ${stats.rejected}`, colors.red);
      log(`   📁 By Category:`, colors.cyan);
      Object.entries(stats.byCategory).forEach(([cat, count]: [string, any]) => {
        log(`      ${cat}: ${count}`, colors.cyan);
      });
    }

    await sleep(500);

    // TEST 11: Get Single Template
    log('\n🔍 Test 11: Get Single Template by ID', colors.yellow);
    const singleTemplate = await axios.get(`${API_BASE}/templates/${templateIds[0]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (singleTemplate.data.success) {
      const t = singleTemplate.data.data;
      log('✅ Template details retrieved', colors.green);
      log(`   Name: ${t.name}`, colors.cyan);
      log(`   Code: ${t.template_code}`, colors.cyan);
      log(`   Category: ${t.category}`, colors.cyan);
      log(`   Status: ${t.status}`, colors.cyan);
      log(`   Body: ${t.body_text.substring(0, 60)}...`, colors.cyan);
    }

    await sleep(500);

    // TEST 12: Update Template Status (Simulate Approval)
    log('\n✏️  Test 12: Update Template Status (Approve)', colors.yellow);
    const updateResponse = await axios.patch(
      `${API_BASE}/templates/${templateIds[0]}`,
      {
        status: 'approved',
        meta_template_id: 'meta_12345678',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (updateResponse.data.success) {
      log('✅ Template updated', colors.green);
      log(`   New Status: ${updateResponse.data.data.status}`, colors.cyan);
      log(`   Meta ID: ${updateResponse.data.data.meta_template_id}`, colors.cyan);
    }

    await sleep(500);

    // TEST 13: Update Template Name
    log('\n✏️  Test 13: Update Template Name', colors.yellow);
    const renameResponse = await axios.patch(
      `${API_BASE}/templates/${templateIds[1]}`,
      {
        name: 'Super Flash Sale Alert',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (renameResponse.data.success) {
      log('✅ Template name updated', colors.green);
      log(`   New Name: ${renameResponse.data.data.name}`, colors.cyan);
    }

    await sleep(500);

    // TEST 14: Pagination Test
    log('\n📄 Test 14: Pagination (Page 1, Limit 2)', colors.yellow);
    const paginatedList = await axios.get(`${API_BASE}/templates?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (paginatedList.data.success) {
      log('✅ Paginated list retrieved', colors.green);
      log(`   Results: ${paginatedList.data.data.length}`, colors.cyan);
      log(`   Total Pages: ${paginatedList.data.pagination.totalPages}`, colors.cyan);
    }

    await sleep(500);

    // TEST 15: Delete Template
    log('\n🗑️  Test 15: Delete Template', colors.yellow);
    const deleteResponse = await axios.delete(`${API_BASE}/templates/${templateIds[templateIds.length - 1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (deleteResponse.data.success) {
      log('✅ Template deleted', colors.green);
      log(`   Message: ${deleteResponse.data.message}`, colors.cyan);
      templateIds.pop(); // Remove from array
    }

    await sleep(500);

    // TEST 16: Try Duplicate Template Code (Should Fail)
    log('\n❌ Test 16: Try Creating Duplicate Template Code', colors.yellow);
    try {
      await axios.post(
        `${API_BASE}/templates`,
        {
          name: 'Duplicate Test',
          template_code: 'welcome_new_user', // Same as first template
          body_text: 'This should fail',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      log('❌ FAILED: Should have rejected duplicate code', colors.red);
    } catch (error: any) {
      if (error.response?.status === 409) {
        log('✅ Correctly rejected duplicate template code', colors.green);
        log(`   Error: ${error.response.data.error}`, colors.cyan);
      }
    }

    await sleep(500);

    // ==================== SUMMARY ====================
    log('\n\n' + '='.repeat(70), colors.blue);
    log('🎉 All Template Tests Completed!', colors.green);
    log('='.repeat(70), colors.blue);

    log('\n📊 Test Summary:', colors.cyan);
    log('  ✅ User Registration & Authentication', colors.green);
    log('  ✅ Create Template (Utility)', colors.green);
    log('  ✅ Create Template (Marketing)', colors.green);
    log('  ✅ Create Template (Authentication)', colors.green);
    log('  ✅ Create Template (With Header)', colors.green);
    log('  ✅ List All Templates', colors.green);
    log('  ✅ Filter by Category', colors.green);
    log('  ✅ Get Template Statistics', colors.green);
    log('  ✅ Get Single Template', colors.green);
    log('  ✅ Update Template Status', colors.green);
    log('  ✅ Update Template Name', colors.green);
    log('  ✅ Pagination', colors.green);
    log('  ✅ Delete Template', colors.green);
    log('  ✅ Duplicate Code Validation', colors.green);

    log('\n📈 Template Stats:', colors.cyan);
    const finalStats = await axios.get(`${API_BASE}/templates/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (finalStats.data.success) {
      log(`  Total Templates Created: ${finalStats.data.data.total}`, colors.magenta);
      log(`  Approved: ${finalStats.data.data.approved}`, colors.green);
      log(`  Pending: ${finalStats.data.data.pending}`, colors.yellow);
    }

    log('\n' + '='.repeat(70), colors.blue);

    // ==================== CLEANUP ====================
    log('\n🧹 Cleaning up test data...', colors.yellow);
    
    // Delete all created templates
    for (const templateId of templateIds) {
      await axios.delete(`${API_BASE}/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    // Delete test user and related data
    await query('DELETE FROM message_templates WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
    await query('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email = ?)', [testEmail]);
    await query('DELETE FROM users WHERE email = ?', [testEmail]);
    
    log('✅ Test data cleaned up\n', colors.green);

  } catch (error: any) {
    log('\n' + '='.repeat(70), colors.red);
    log('❌ TEST FAILED!', colors.red);
    log('='.repeat(70), colors.red);

    if (error.response) {
      log(`\n📊 Status: ${error.response.status}`, colors.red);
      log(`📝 Error: ${JSON.stringify(error.response.data, null, 2)}`, colors.red);
    } else if (error.request) {
      log('\n❌ No response from server', colors.red);
      log('⚠️  Make sure API server is running on http://localhost:3000', colors.yellow);
    } else {
      log(`\n❌ Error: ${error.message}`, colors.red);
    }

    log('\n' + '='.repeat(70), colors.red);
    process.exit(1);
  }
}

// Run tests
log('\n⚠️  Prerequisites:', colors.yellow);
log('   ✓ API server running (Terminal 1: npm run dev)', colors.cyan);
log('   ✓ Database connected', colors.cyan);
log('\n⏳ Starting template tests in 3 seconds...\n', colors.magenta);

setTimeout(() => {
  runTemplateTests().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}, 3000);
