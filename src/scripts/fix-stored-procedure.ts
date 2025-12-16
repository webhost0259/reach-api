import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';

async function fixStoredProcedure() {
  const connection = await pool.getConnection();

  try {
    console.log('🔧 Fixing sp_get_campaign_stats...\n');

    // Drop old procedure
    await connection.query('DROP PROCEDURE IF EXISTS sp_get_campaign_stats');
    console.log('✓ Dropped old procedure');

    // Create new one with explicit collation
    await connection.query(`
      CREATE PROCEDURE sp_get_campaign_stats(IN p_tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci)
      BEGIN
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
          SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as sending,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM campaigns
        WHERE tenant_id = p_tenant_id COLLATE utf8mb4_unicode_ci;
      END
    `);
    console.log('✓ Created new procedure with correct collation');

    // Test it
    console.log('\n🧪 Testing...');
    const [result]: any = await connection.query(
      'CALL sp_get_campaign_stats(?)',
      ['73f2ef3d-b125-4258-92ed-0ba1ec60350f']
    );
    console.log('✅ Result:', result[0][0]);

    console.log('\n✅ Fixed!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

fixStoredProcedure()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
