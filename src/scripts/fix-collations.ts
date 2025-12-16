import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';

async function fixCollations() {
  const connection = await pool.getConnection();

  try {
    console.log('🔧 Fixing database collations...\n');

    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Disabled foreign key checks');

    // List of all tables
    const tables = [
      'api_keys',
      'audit_log',
      'campaigns',
      'campaign_analytics',
      'campaign_logs',
      'campaign_recipients',
      'customers',
      'customer_groups',
      'customer_group_members',
      'inbound_messages',
      'messages',
      'message_templates',
      'plan_tiers',
      'users',
      'webhooks',
      'whatsapp_configs',
    ];

    // Fix each table
    for (const table of tables) {
      try {
        await connection.query(
          `ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        console.log(`✓ Fixed ${table}`);
      } catch (error: any) {
        console.log(`⚠️  Skipped ${table}: ${error.message}`);
      }
    }

    // Set database default
    await connection.query(`
      ALTER DATABASE messaging_platform 
      CHARACTER SET = utf8mb4 
      COLLATE = utf8mb4_unicode_ci
    `);
    console.log('✓ Set database default collation');

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Re-enabled foreign key checks');

    // Verify
    const [tables_result]: any = await connection.query(`
      SELECT TABLE_NAME, TABLE_COLLATION 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'messaging_platform'
      ORDER BY TABLE_NAME
    `);

    console.log('\n📊 Table Collations:');
    tables_result.forEach((row: any) => {
      const status = row.TABLE_COLLATION === 'utf8mb4_unicode_ci' ? '✅' : '❌';
      console.log(`  ${status} ${row.TABLE_NAME}: ${row.TABLE_COLLATION}`);
    });

    console.log('\n✅ All done!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

fixCollations()
  .then(() => {
    console.log('Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
