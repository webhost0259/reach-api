import pool from '../config/database';

const check = async () => {
  const [procs]: any = await pool.query(
    'SHOW PROCEDURE STATUS WHERE Db = ?', 
    ['messaging_platform']
  );
  
  console.log('📋 Current Stored Procedures:\n');
  procs.forEach((p: any) => console.log('  ✓', p.Name));
  
  // Test one
  console.log('\n🧪 Testing sp_get_campaign_stats...');
  const [result]: any = await pool.query(
    'CALL sp_get_campaign_stats(?)',
    ['73f2ef3d-b125-4258-92ed-0ba1ec60350f']
  );
  console.log('✅ Result:', result[0][0]);
  
  process.exit(0);
};

check();