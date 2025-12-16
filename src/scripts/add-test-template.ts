import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../config/database';

async function addTestTemplate() {
  const connection = await pool.getConnection();

  try {
    console.log('📝 Adding hello_world template for testing...\n');

    const templateId = uuidv4();
    const tenantId = '73f2ef3d-b125-4258-92ed-0ba1ec60350f'; // Your tenant ID
    const userId = 'd04a000c-f07d-455b-8f27-70386c4dbd32'; // Your user ID

    await connection.query(`
      INSERT INTO message_templates (
        id,
        tenant_id,
        user_id,
        name,
        template_code,
        language,
        category,
        status,
        header_type,
        body_text,
        footer_text,
        meta_template_id,
        approved_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      templateId,
      tenantId,
      userId,
      'Hello World',
      'hello_world',
      'en_US',
      'utility',
      'approved', // ✅ Set as approved for testing
      'none',
      'Welcome and congratulations! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.',
      null,
      'hello_world',
    ]);

    console.log('✅ Template added successfully!');
    console.log('   ID:', templateId);
    console.log('   Code: hello_world');
    console.log('   Status: approved\n');

  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('ℹ️  Template already exists. Updating status to approved...');
      await connection.query(`
        UPDATE message_templates 
        SET status = 'approved', approved_at = NOW()
        WHERE template_code = 'hello_world' AND tenant_id = ?
      `, [tenantId]);
      console.log('✅ Updated to approved!\n');
    } else {
      throw error;
    }
  } finally {
    connection.release();
  }
}

addTestTemplate()
  .then(() => {
    console.log('Done! You can now create a test campaign.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
