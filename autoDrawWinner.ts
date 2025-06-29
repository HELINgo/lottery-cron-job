import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ✅ Supabase 设置
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const drawWinner = async () => {
  console.log('🎯 正在检查是否有轮次需要开奖...');

  const now = new Date().toISOString();

  // ✅ 查找已结束但尚未开奖的轮次
  const { data: expiredRounds, error: roundError } = await supabase
    .from('lottery_rounds')
    .select('*')
    .lte('end_time', now)
    .eq('status', 'open');

  if (roundError) {
    console.error('❌ 查询轮次失败:', roundError);
    return;
  }

  if (!expiredRounds || expiredRounds.length === 0) {
    console.log('❌ 没有需要开奖的轮次');
    return;
  }

  const round = expiredRounds[0];
  console.log(`🎲 开始开奖，轮次 ID: ${round.id}`);

  // ✅ 查询参与者
  const { data: entries, error: entryError } = await supabase
    .from('lottery_entries')
    .select('*')
    .eq('round_id', round.id);

  if (entryError) {
    console.error('❌ 查询参与者失败:', entryError);
    return;
  }

  if (!entries || entries.length === 0) {
    console.log('⚠️ 没有参与者，轮次作废');
    await supabase
      .from('lottery_rounds')
      .update({ status: 'no_entries' })
      .eq('id', round.id);
    return;
  }

  // ✅ 随机抽奖
  const winnerEntry = entries[Math.floor(Math.random() * entries.length)];
  console.log(`🎉 中奖者: ${winnerEntry.wallet}, 号码: ${winnerEntry.ticket_number}`);

  // ✅ 查询 X 账号
  const { data: xHandleData, error: xHandleError } = await supabase
    .from('x_handles')
    .select('x')
    .eq('wallet', winnerEntry.wallet)
    .maybeSingle();

  if (xHandleError) {
    console.error('⚠️ 查询 X 账号失败:', xHandleError);
  }

  // ✅ 写入 lottery_history
  const { error: insertError } = await supabase.from('lottery_history').insert([
    {
      id: randomUUID(),
      wallet: winnerEntry.wallet,
      round_id: round.id,
      number: winnerEntry.ticket_number,
      amount: entries.length * 0.01,
      round_time: round.end_time,
      twitter: xHandleData?.x || null,
    },
  ]);

  if (insertError) {
    console.error('❌ 写入 lottery_history 失败:', insertError);
    return;
  }

  console.log(`✅ 中奖者已记录：${winnerEntry.wallet}`);

  // ✅ 更新当前轮次状态为已开奖
  const { error: updateError } = await supabase
    .from('lottery_rounds')
    .update({ status: 'drawn' })
    .eq('id', round.id);

  if (updateError) {
    console.error('❌ 更新轮次状态失败:', updateError);
  }

  // ✅ 创建下一轮（5 分钟后开奖）
  const nowTime = new Date();
  const endTime = new Date(nowTime.getTime() + 5 * 60 * 1000);

  const { error: createError } = await supabase.from('lottery_rounds').insert([
    {
      id: randomUUID(),
      start_time: nowTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'open',
    },
  ]);

  if (createError) {
    console.error('❌ 创建下一轮失败:', createError);
    return;
  }

  console.log(`🚀 已开启下一轮，截止时间 ${endTime.toISOString()}`);
};

drawWinner();