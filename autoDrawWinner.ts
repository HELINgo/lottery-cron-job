import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ✅ 初始化 Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const drawWinner = async () => {
  console.log('🎯 正在检查是否有需要开奖的轮次...');

  const now = new Date().toISOString();

  // ✅ 查询需要开奖的轮次
  const { data: expiredRounds, error: roundError } = await supabase
    .from('lottery_rounds')
    .select('*')
    .lte('end_time', now)
    .eq('status', 'open');

  if (roundError) {
    console.error('❌ 查询轮次失败:', roundError.message);
    return;
  }

  if (!expiredRounds || expiredRounds.length === 0) {
    console.log('❌ 当前没有需要开奖的轮次');
    return;
  }

  const round = expiredRounds[0];
  console.log(`🎲 开始开奖 - 轮次 ID: ${round.id}`);

  // ✅ 获取参与者
  const { data: entries, error: entryError } = await supabase
    .from('lottery_entries')
    .select('*')
    .eq('round_id', round.id);

  if (entryError) {
    console.error('❌ 获取参与者失败:', entryError.message);
    return;
  }

  if (!entries || entries.length === 0) {
    console.warn('⚠️ 本轮没有参与者，标记为作废');
    await supabase
      .from('lottery_rounds')
      .update({ status: 'no_entries' })
      .eq('id', round.id);
    return;
  }

  // ✅ 随机抽取中奖者
  const winnerEntry = entries[Math.floor(Math.random() * entries.length)];
  console.log(`🎉 抽中奖励: ${winnerEntry.wallet}（号码: ${winnerEntry.ticket_number}）`);

  // ✅ 获取 X（Twitter）账号
  const { data: xHandleData, error: xError } = await supabase
    .from('x_handles')
    .select('x')
    .eq('wallet', winnerEntry.wallet)
    .maybeSingle();

  if (xError) {
    console.warn('⚠️ 获取 X 账号失败:', xError.message);
  }

  // ✅ 写入中奖历史
  const { error: historyError } = await supabase.from('lottery_history').insert([
    {
      id: randomUUID(),
      wallet: winnerEntry.wallet,
      round_id: round.id,
      number: winnerEntry.ticket_number,
      amount: entries.length * 0.01, // 每人 0.01 SOL
      round_time: round.end_time,
      twitter: xHandleData?.x || null,
    },
  ]);

  if (historyError) {
    console.error('❌ 写入中奖记录失败:', historyError.message);
    return;
  }

  console.log('✅ 已写入中奖记录');

  // ✅ 更新当前轮次状态为 drawn
  const { error: updateRoundError } = await supabase
    .from('lottery_rounds')
    .update({ status: 'drawn' })
    .eq('id', round.id);

  if (updateRoundError) {
    console.error('❌ 更新轮次状态失败:', updateRoundError.message);
    return;
  }

  console.log('📦 本轮开奖完成 ✅');

  // ✅ 创建下一轮（5 分钟后开奖）
  const newStart = new Date();
  const newEnd = new Date(newStart.getTime() + 5 * 60 * 1000); // 5 分钟后

  const { error: createNextError } = await supabase.from('lottery_rounds').insert([
    {
      id: randomUUID(),
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      status: 'open',
    },
  ]);

  if (createNextError) {
    console.error('❌ 创建下一轮失败:', createNextError.message);
    return;
  }

  console.log(`🚀 下一轮已开启，截止时间: ${newEnd.toISOString()}`);
};

// ✅ 执行
drawWinner();
