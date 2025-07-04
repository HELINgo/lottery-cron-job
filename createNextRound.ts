import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vpinbblavyiryvdoyvsn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW5iYmxhdnlpcnl2ZG95dnNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTI1NjY3MiwiZXhwIjoyMDY0ODMyNjcyfQ.xAyrtOMFy1-AmDa2ffR8GzccjugnJ0P3LtIPi0qK7Jk'
);

async function createNextRound() {
  const { data: nowResult, error: nowError } = await supabase.rpc('get_now');

  if (nowError || !nowResult?.now) {
    console.error('❌ 获取服务器时间失败:', nowError?.message ?? nowResult);
    return;
  }

  const now = new Date(nowResult.now);
  const end = new Date(now.getTime() + 10 * 60 * 1000);

  console.log('📌 当前时间:', now.toISOString());
  console.log('📌 结束时间:', end.toISOString());

  const { error: updateError } = await supabase
    .from('lottery_rounds')
    .update({ is_current: false })
    .eq('is_current', true);

  if (updateError) {
    console.error('❌ 无法关闭旧轮次:', updateError.message);
    return;
  }

  const { error: insertError } = await supabase.from('lottery_rounds').insert({
    start_time: now.toISOString(),
    end_time: end.toISOString(),
    status: 'open',
    is_current: true,
  });

  if (insertError) {
    console.error('❌ 新轮次插入失败:', insertError.message);
  } else {
    console.log('✅ 新轮次创建成功');
  }
}

createNextRound();


