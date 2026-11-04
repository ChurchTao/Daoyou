/**
 * 剧本生成链路（大纲、正文、审校）开启模型的思考模式。不指定思考强度：
 * 部分模型（如 DashScope 上的 kimi-k3）不支持 thinking_budget，会直接拒绝请求。
 */
export const MYSTERY_GENERATION_THINKING = true;

/**
 * 单步总时限，含结构校验失败后的重试。开启思考后大纲一次约 1 万输出 token、
 * 耗时约 5 分钟，须容得下两次尝试；生成在后台进行，留足时间。
 */
export const MYSTERY_STAGE_TIMEOUT_MS = 15 * 60_000;
