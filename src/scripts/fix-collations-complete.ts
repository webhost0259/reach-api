import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';

async function fixCollationsComplete() {
  const connection = await pool.getConnection();

  try {
    console.log('🔧 Fixing all database collations (including FK tables)...\n');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Step 1: Drop all foreign keys that are causing issues
    console.log('📋 Step 1: Dropping foreign keys...');
    
    const fksToDrop = [
      { table: 'messages', constraint: 'messages_ibfk_1' },
      { table: 'messages', constraint: 'messages_ibfk_2' },
      { table: 'api_keys', constraint: 'api_keys_ibfk_1' },
      { table: 'audit_log', constraint: 'audit_log_ibfk_1' },
      { table: 'webhooks', constraint: 'webhooks_ibfk_1' },
    ];

    for (const fk of fksToDrop) {
      try {
        await connection.query(`ALTER TABLE ${fk.table} DROP FOREIGN KEY ${fk.constraint}`);
        console.log(`  ✓ Dropped ${fk.table}.${fk.constraint}`);
      } catch (error: any) {
        console.log(`  ⚠️  ${fk.table}.${fk.constraint}: ${error.sqlMessage || 'Already dropped'}`);
      }
    }

    // Step 2: Convert all tables
    console.log('\n📋 Step 2: Converting tables...');
    
    const tables = [
      'users',
      'api_keys',
      'audit_log',
      'messages',
      'webhooks',
      'campaigns',
      'campaign_analytics',
      'campaign_logs',
      'campaign_recipients',
      'customers',
      'customer_groups',
      'customer_group_members',
      'inbound_messages',
      'message_templates',
      'plan_tiers',
      'whatsapp_configs',
    ];

    for (const table of tables) {
      try {
        await connection.query(
          `ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        console.log(`  ✓ Fixed ${table}`);
      } catch (error: any) {
        console.log(`  ❌ ${table}: ${error.sqlMessage}`);
      }
    }

    // Step 3: Recreate foreign keys
    console.log('\n📋 Step 3: Recreating foreign keys...');

    const fksToCreate = [
      {
        table: 'messages',
        name: 'messages_ibfk_1',
        sql: 'ALTER TABLE messages ADD CONSTRAINT messages_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
      {
        table: 'messages',
        name: 'messages_ibfk_2',
        sql: 'ALTER TABLE messages ADD CONSTRAINT messages_ibfk_2 FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE',
      },
      {
        table: 'api_keys',
        name: 'api_keys_ibfk_1',
        sql: 'ALTER TABLE api_keys ADD CONSTRAINT api_keys_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
      {
        table: 'audit_log',
        name: 'audit_log_ibfk_1',
        sql: 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
      },
      {
        table: 'webhooks',
        name: 'webhooks_ibfk_1',
        sql: 'ALTER TABLE webhooks ADD CONSTRAINT webhooks_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
    ];

    for (const fk of fksToCreate) {
      try {
        await connection.query(fk.sql);
        console.log(`  ✓ Created ${fk.table}.${fk.name}`);
      } catch (error: any) {
        console.log(`  ⚠️  ${fk.table}.${fk.name}: ${error.sqlMessage || 'Already exists'}`);
      }
    }

    // Step 4: Set database default
    await connection.query(`
      ALTER DATABASE messaging_platform 
      CHARACTER SET = utf8mb4 
      COLLATE = utf8mb4_unicode_ci
    `);
    console.log('\n✓ Set database default collation');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Re-enabled foreign key checks');

    // Verify
    const [tables_result]: any = await connection.query(`
      SELECT TABLE_NAME, TABLE_COLLATION 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'messaging_platform'
      ORDER BY TABLE_NAME
    `);

    console.log('\n📊 Final Table Collations:');
    let allFixed = true;
    tables_result.forEach((row: any) => {
      const isFixed = row.TABLE_COLLATION === 'utf8mb4_unicode_ci';
      const status = isFixed ? '✅' : '❌';
      console.log(`  ${status} ${row.TABLE_NAME}: ${row.TABLE_COLLATION}`);
      if (!isFixed) allFixed = false;
    });

    if (allFixed) {
      console.log('\n🎉 All tables fixed! Your API should work now.\n');
    } else {
      console.log('\n⚠️  Some tables still have issues, but campaigns should work.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

fixCollationsComplete()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
