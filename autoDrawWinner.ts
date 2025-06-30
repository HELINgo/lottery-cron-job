import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const drawWinner = async () => {
  console.log('🎯 正在检查是否有需要开奖的轮次...');

  const now = new Date().toISOString();

  const { data: expiredRounds, error: roundError } = await supabase
    .from('lottery_rounds')
    .select('*')
    .lt('end_time', now)
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

    // ✅ 即使无人参与也开启新一轮（10分钟后开奖）
    const newStart = new Date();
    const end = new Date(newStart.getTime() + 10 * 60 * 1000);

    const { error: createNextError } = await supabase.from('lottery_rounds').insert([{
      id: randomUUID(),
      start_time: newStart.toISOString(),
      end_time: end.toISOString(),
      status: 'open',
    }]);

    if (createNextError) {
      console.error('❌ 创建下一轮失败:', createNextError.message);
    } else {
      console.log(`🚀 无参与者也已开启新一轮，截止时间: ${end.toISOString()}`);
    }

    return;
  }

  const winnerEntry = entries[Math.floor(Math.random() * entries.length)];
  console.log(`🎉 抽中奖励: ${winnerEntry.wallet}（号码: ${winnerEntry.ticket_number}）`);

  const { data: xHandleData, error: xError } = await supabase
    .from('x_handles')
    .select('x')
    .eq('wallet', winnerEntry.wallet)
    .maybeSingle();

  if (xError) {
    console.warn('⚠️ 获取 X 账号失败:', xError.message);
  }

  const { error: historyError } = await supabase.from('lottery_history').insert([{
    id: randomUUID(),
    wallet: winnerEntry.wallet,
    round_id: round.id,
    number: winnerEntry.ticket_number,
    amount: entries.length * 0.01,
    round_time: round.end_time,
    twitter: xHandleData?.x || null,
  }]);

  if (historyError) {
    console.error('❌ 写入中奖记录失败:', historyError.message);
    return;
  }

  console.log('✅ 已写入中奖记录');

  const { error: updateRoundError } = await supabase
    .from('lottery_rounds')
    .update({ status: 'drawn' })
    .eq('id', round.id);

  if (updateRoundError) {
    console.error('❌ 更新轮次状态失败:', updateRoundError.message);
    return;
  }

  console.log('📦 本轮开奖完成 ✅');

  // ✅ 开启下一轮，时间为 10 分钟
  const newStart = new Date();
  const end = new Date(newStart.getTime() + 10 * 60 * 1000);

  const { error: createNextError } = await supabase.from('lottery_rounds').insert([{
    id: randomUUID(),
    start_time: newStart.toISOString(),
    end_time: end.toISOString(),
    status: 'open',
  }]);

  if (createNextError) {
    console.error('❌ 创建下一轮失败:', createNextError.message);
    return;
  }

  console.log(`🚀 下一轮已开启，截止时间: ${end.toISOString()}`);
};

drawWinner();


