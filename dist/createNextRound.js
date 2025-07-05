import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
    // 获取已结束但未开奖的轮次
    const { data: expiredRounds, error: roundError } = await supabase
        .from('lottery_rounds')
        .select('*')
        .lt('end_time', now)
        .eq('status', 'open');
    if (roundError)
        return console.error('❌ 查询轮次失败:', roundError.message);
    if (!expiredRounds || expiredRounds.length === 0) {
        console.log('❌ 当前没有需要开奖的轮次');
        return;
    }
    const round = expiredRounds[0];
    console.log(`🎲 开始开奖 - 轮次 ID: ${round.id}`);
    // 判断是否已开奖
    const { data: existingHistory } = await supabase
        .from('lottery_history')
        .select('id')
        .eq('round_id', round.id)
        .maybeSingle();
    if (existingHistory) {
        console.warn('⚠️ 已开奖，跳过...');
        return;
    }
    // 获取参与者
    const { data: entries, error: entryError } = await supabase
        .from('lottery_entries')
        .select('*')
        .eq('round_id', round.id);
    if (entryError)
        return console.error('❌ 获取参与者失败:', entryError.message);
    if (!entries || entries.length === 0) {
        console.warn('⚠️ 无参与者，标记为作废');
        await supabase
            .from('lottery_rounds')
            .update({ status: 'no_entries', is_current: false })
            .eq('id', round.id);
    }
    else {
        const winnerEntry = entries[Math.floor(Math.random() * entries.length)];
        const { data: xHandleData } = await supabase
            .from('x_handles')
            .select('x')
            .eq('wallet', winnerEntry.wallet)
            .maybeSingle();
        await supabase.from('lottery_history').insert([{
                id: randomUUID(),
                wallet: winnerEntry.wallet,
                round_id: round.id,
                number: winnerEntry.ticket_number,
                amount: entries.length * 0.01,
                round_time: round.end_time,
                twitter: xHandleData?.x || null,
            }]);
        await supabase
            .from('lottery_rounds')
            .update({ status: 'drawn', is_current: false })
            .eq('id', round.id);
        console.log(`✅ 已开奖: ${winnerEntry.wallet}`);
    }
    // 检查是否已经存在 "open 且 is_current = true" 的轮次
    const { data: currentRounds } = await supabase
        .from('lottery_rounds')
        .select('id')
        .eq('is_current', true)
        .eq('status', 'open');
    if (currentRounds && currentRounds.length > 0) {
        console.warn('⚠️ 已有当前轮次，跳过新建');
        return;
    }
    // 插入新一轮
    const newStart = new Date();
    const newEnd = new Date(newStart.getTime() + 24 * 60 * 60 * 1000); // +24小时
    const { error: insertError } = await supabase.from('lottery_rounds').insert([{
            id: randomUUID(),
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            status: 'open',
            is_current: true,
        }]);
    if (insertError) {
        console.error('❌ 创建下一轮失败:', insertError.message);
    }
    else {
        console.log(`🚀 新一轮已开启，结束时间: ${newEnd.toISOString()}`);
    }
};
drawWinner();
