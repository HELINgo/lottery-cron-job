import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vpinbblavyiryvdoyvsn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW5iYmxhdnlpcnl2ZG95dnNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTI1NjY3MiwiZXhwIjoyMDY0ODMyNjcyfQ.xAyrtOMFy1-AmDa2ffR8GzccjugnJ0P3LtIPi0qK7Jk'
);

async function createNextRound() {
  const now = new Date();
  const end = new Date(now.getTime() + 10 * 60 * 1000); // ✅ 10分钟后开奖

  const { error } = await supabase.from('lottery_rounds').insert({
    start_time: now.toISOString(),
    end_time: end.toISOString(),
    status: 'open', // ✅ 必须统一为 'open'
  });

  if (error) {
    console.error('❌ 创建新轮次失败:', error.message);
  } else {
    console.log('✅ 创建成功：', now.toISOString(), '➔', end.toISOString());
  }
}

createNextRound();

