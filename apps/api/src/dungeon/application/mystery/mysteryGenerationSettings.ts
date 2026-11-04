/**
 * 剧本生成各步是否开启模型的思考模式。大纲定真相与人物、审校找矛盾，最依赖推理，开启；
 * 正文三段只按已定的大纲写文字，不开，省下约一半耗时。不指定思考强度：
 * 部分模型（如 DashScope 上的 kimi-k3）不支持 thinking_budget，会直接拒绝请求。
 */
export const MYSTERY_GENERATION_THINKING = {
  outline: true,
  text: false,
  review: true,
} as const;

/**
 * 单步总时限，含结构校验失败后的重试。开启思考后大纲一次约 1 万输出 token、
 * 耗时约 5 分钟，须容得下两次尝试；生成在后台进行，留足时间。
 */
export const MYSTERY_STAGE_TIMEOUT_MS = 15 * 60_000;
