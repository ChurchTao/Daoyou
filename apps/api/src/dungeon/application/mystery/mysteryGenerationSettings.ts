/**
 * 剧本生成各步是否开启模型的思考模式。大纲定真相与人物、审校找矛盾，最依赖推理，开启；
 * 正文三段只按已定的大纲写文字，不开，省下约一半耗时。
 * 开启思考的 Alibaba 调用通过原生 providerOptions 设置 4096 token 思考预算。
 */
export const MYSTERY_GENERATION_THINKING = {
  outline: true,
  text: false,
  review: true,
} as const;

/**
 * 单次模型调用的总时限，包含网络重试与退避；业务流程重新生成时另起一次调用。
 * 开启思考后大纲耗时较长，生成在后台进行，留足时间。
 */
export const MYSTERY_STAGE_TIMEOUT_MS = 15 * 60_000;
