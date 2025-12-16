import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';

async function createStoredProcedures() {
  console.log('Database Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
  });

  const connection = await pool.getConnection();

  try {
    console.log('\nCreating stored procedures...\n');

    // Drop existing procedures
    const drops = [
      'DROP PROCEDURE IF EXISTS sp_get_campaign_stats',
      'DROP PROCEDURE IF EXISTS sp_create_campaign_snapshot',
      'DROP PROCEDURE IF EXISTS sp_update_recipient_status',
      'DROP PROCEDURE IF EXISTS sp_get_next_recipient_batch',
      'DROP PROCEDURE IF EXISTS sp_get_scheduled_campaigns',
      'DROP PROCEDURE IF EXISTS sp_get_retry_campaigns',
      'DROP PROCEDURE IF EXISTS sp_check_campaign_completion',
    ];

    for (const drop of drops) {
      await connection.query(drop);
    }
    console.log('✓ Dropped existing procedures\n');

    // 1. Get Campaign Stats
    await connection.query(`
      CREATE PROCEDURE sp_get_campaign_stats(IN p_tenant_id VARCHAR(36))
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
        WHERE tenant_id = p_tenant_id;
      END
    `);
    console.log('✓ Created sp_get_campaign_stats');

    // 2. Create Campaign Snapshot
    await connection.query(`
      CREATE PROCEDURE sp_create_campaign_snapshot(IN p_campaign_id VARCHAR(36))
      BEGIN
        INSERT INTO campaign_analytics (
          id, campaign_id, total_recipients, pending_count, sent_count,
          delivered_count, read_count, failed_count,
          delivery_rate, read_rate, failure_rate, snapshot_at
        )
        SELECT 
          UUID(),
          id,
          total_recipients,
          pending_count,
          sent_count,
          delivered_count,
          read_count,
          failed_count,
          CASE WHEN sent_count > 0 THEN ROUND((delivered_count / sent_count * 100), 2) ELSE 0 END,
          CASE WHEN delivered_count > 0 THEN ROUND((read_count / delivered_count * 100), 2) ELSE 0 END,
          CASE WHEN total_recipients > 0 THEN ROUND((failed_count / total_recipients * 100), 2) ELSE 0 END,
          NOW()
        FROM campaigns
        WHERE id = p_campaign_id;
      END
    `);
    console.log('✓ Created sp_create_campaign_snapshot');

    // 3. Update Recipient Status
    await connection.query(`
      CREATE PROCEDURE sp_update_recipient_status(
        IN p_recipient_id VARCHAR(36),
        IN p_new_status VARCHAR(50),
        IN p_message_id VARCHAR(36),
        IN p_whatsapp_message_id VARCHAR(255),
        IN p_error_message TEXT
      )
      BEGIN
        DECLARE v_campaign_id VARCHAR(36);
        DECLARE v_old_status VARCHAR(50);
        
        SELECT campaign_id, status INTO v_campaign_id, v_old_status
        FROM campaign_recipients
        WHERE id = p_recipient_id;
        
        UPDATE campaign_recipients
        SET 
          status = p_new_status,
          message_id = COALESCE(p_message_id, message_id),
          whatsapp_message_id = COALESCE(p_whatsapp_message_id, whatsapp_message_id),
          error_message = COALESCE(p_error_message, error_message),
          sent_at = CASE WHEN p_new_status = 'sent' THEN NOW() ELSE sent_at END,
          delivered_at = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE delivered_at END,
          read_at = CASE WHEN p_new_status = 'read' THEN NOW() ELSE read_at END,
          failed_at = CASE WHEN p_new_status = 'failed' THEN NOW() ELSE failed_at END,
          updated_at = NOW()
        WHERE id = p_recipient_id;
        
        IF v_old_status != p_new_status THEN
          UPDATE campaigns
          SET
            pending_count = CASE WHEN v_old_status = 'pending' THEN GREATEST(pending_count - 1, 0) ELSE pending_count END,
            sent_count = CASE WHEN v_old_status = 'sent' THEN GREATEST(sent_count - 1, 0) ELSE sent_count END,
            delivered_count = CASE WHEN v_old_status = 'delivered' THEN GREATEST(delivered_count - 1, 0) ELSE delivered_count END,
            read_count = CASE WHEN v_old_status = 'read' THEN GREATEST(read_count - 1, 0) ELSE read_count END,
            failed_count = CASE WHEN v_old_status = 'failed' THEN GREATEST(failed_count - 1, 0) ELSE failed_count END,
            updated_at = NOW()
          WHERE id = v_campaign_id;
          
          UPDATE campaigns
          SET
            pending_count = CASE WHEN p_new_status = 'pending' THEN pending_count + 1 ELSE pending_count END,
            sent_count = CASE WHEN p_new_status = 'sent' THEN sent_count + 1 ELSE sent_count END,
            delivered_count = CASE WHEN p_new_status = 'delivered' THEN delivered_count + 1 ELSE delivered_count END,
            read_count = CASE WHEN p_new_status = 'read' THEN read_count + 1 ELSE read_count END,
            failed_count = CASE WHEN p_new_status = 'failed' THEN failed_count + 1 ELSE failed_count END,
            updated_at = NOW()
          WHERE id = v_campaign_id;
        END IF;
      END
    `);
    console.log('✓ Created sp_update_recipient_status');

    // 4. Get Next Recipient Batch
    await connection.query(`
      CREATE PROCEDURE sp_get_next_recipient_batch(
        IN p_campaign_id VARCHAR(36),
        IN p_batch_size INT
      )
      BEGIN
        SELECT * FROM campaign_recipients
        WHERE campaign_id = p_campaign_id
          AND status IN ('pending', 'failed')
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY created_at ASC
        LIMIT p_batch_size;
      END
    `);
    console.log('✓ Created sp_get_next_recipient_batch');

    // 5. Get Scheduled Campaigns
    await connection.query(`
      CREATE PROCEDURE sp_get_scheduled_campaigns()
      BEGIN
        SELECT id, tenant_id, name
        FROM campaigns
        WHERE status = 'scheduled'
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC;
      END
    `);
    console.log('✓ Created sp_get_scheduled_campaigns');

    // 6. Get Retry Campaigns
    await connection.query(`
      CREATE PROCEDURE sp_get_retry_campaigns()
      BEGIN
        SELECT DISTINCT c.id, c.tenant_id, c.name
        FROM campaigns c
        INNER JOIN campaign_recipients cr ON c.id = cr.campaign_id
        WHERE c.status IN ('sending', 'queued')
          AND c.retry_failed = 1
          AND cr.status = 'pending'
          AND cr.next_retry_at IS NOT NULL
          AND cr.next_retry_at <= NOW()
        ORDER BY cr.next_retry_at ASC;
      END
    `);
    console.log('✓ Created sp_get_retry_campaigns');

    // 7. Check Campaign Completion
    await connection.query(`
      CREATE PROCEDURE sp_check_campaign_completion(IN p_campaign_id VARCHAR(36))
      BEGIN
        DECLARE v_pending INT;
        DECLARE v_status VARCHAR(50);
        
        SELECT pending_count, status INTO v_pending, v_status
        FROM campaigns
        WHERE id = p_campaign_id;
        
        IF v_pending = 0 AND v_status IN ('sending', 'queued') THEN
          UPDATE campaigns
          SET 
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = p_campaign_id;
        END IF;
      END
    `);
    console.log('✓ Created sp_check_campaign_completion');

    console.log('\n✅ All stored procedures created successfully!\n');

    // Verify
    const dbName = process.env.DB_NAME || 'messaging_platform';
    const [procedures]: any = await connection.query(
      `SHOW PROCEDURE STATUS WHERE Db = ?`,
      [dbName]
    );
    
    console.log('Created procedures:');
    if (Array.isArray(procedures)) {
      procedures.forEach((proc: any) => {
        console.log(`  - ${proc.Name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error creating stored procedures:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script
createStoredProcedures()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
