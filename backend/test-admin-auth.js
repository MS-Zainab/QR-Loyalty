require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function test() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.error('ADMIN AUTH TEST ERROR:', error);
    return;
  }

  console.log('ADMIN AUTH TEST SUCCESS');
  console.log('Users found:', data.users.length);
}

test();