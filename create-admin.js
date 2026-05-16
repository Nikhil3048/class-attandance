require('dotenv').config();
const { supabaseAdmin } = require('./server/config/supabase');

// ✏️ Change these values before running
const ADMIN_EMAIL    = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME     = 'Admin User';

async function createAdmin() {
  console.log('Creating admin user...');

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    process.exit(1);
  }

  // 2. Insert into users table
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({ id: authData.user.id, name: ADMIN_NAME, email: ADMIN_EMAIL, role: 'admin' });

  if (profileError) {
    console.error('❌ Profile error:', profileError.message);
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }

  console.log(`✅ Admin created successfully!`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Name:  ${ADMIN_NAME}`);
  console.log(`   Role:  admin`);
  process.exit(0);
}

createAdmin();
