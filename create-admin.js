require('dotenv').config();
const { supabaseAdmin } = require('./server/config/supabase');

// Usage: node create-admin.js <email> <password> "<name>"
// If no arguments are provided, it uses the default dummy values.
const ADMIN_EMAIL    = process.argv[2] || 'admin@example.com';
const ADMIN_PASSWORD = process.argv[3] || 'Admin@1234';
const ADMIN_NAME     = process.argv[4] || 'Admin User';

async function createAdmin() {
  console.log('Checking if user exists...');

  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error fetching users:', listError.message);
    process.exit(1);
  }

  const existingUser = usersData.users.find(u => u.email === ADMIN_EMAIL);
  let userId;

  if (existingUser) {
    console.log(`User ${ADMIN_EMAIL} already exists. Updating password and promoting to admin...`);
    userId = existingUser.id;
    
    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true
    });

    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);
      process.exit(1);
    }
  } else {
    console.log(`Creating new admin user: ${ADMIN_EMAIL}...`);
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      process.exit(1);
    }
    userId = authData.user.id;
  }

  // Insert or update into public.users table
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, name: ADMIN_NAME, email: ADMIN_EMAIL, role: 'admin' });

  if (profileError) {
    console.error('❌ Profile error:', profileError.message);
    process.exit(1);
  }

  console.log(`✅ Admin updated/created successfully!`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: (Updated to what you typed)`);
  console.log(`   Name:  ${ADMIN_NAME}`);
  console.log(`   Role:  admin`);
  
  // Force clean exit to prevent hanging from Supabase timers
  setTimeout(() => process.exit(0), 500);
}

createAdmin();
