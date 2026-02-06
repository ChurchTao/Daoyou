import { createClient } from '@supabase/supabase-js';

describe('Auth', () => {
  it('should do something', async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_AUTH_SERVICE_KEY;

    const supabaseAdmin = createClient(
      supabaseUrl!,
      supabaseKey!, // 只在服务端
    );
    // 绑定supabase用户到某个邮箱
    const userId = 'xx';
    const email = 'xx';
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email,
        // 不要在这里直接 email_confirm: true（除非你完全信任邮箱归属）
      },
    );
    if (error) throw error;
    console.log('data', data);
    console.log('error', error);
    return data;
  });
});
