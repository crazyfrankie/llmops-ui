// api请求接口前缀
export const apiPrefix: string = import.meta.env.VITE_API_PREFIX

// 业务状态码
export const httpCode = {
  success: 20000,
  unauthorized: 40001,
  validateError: 40002,
  forbidden: 40003,
  notFound: 40004,
  fail: 50000,
}

// 类型字符串与中文映射
export const typeMap: { [key: string]: string } = {
  str: '字符串',
  int: '整型',
  float: '浮点型',
  bool: '布尔值',
}

// 智能体事件类型
export const QueueEvent = {
  longTermMemoryRecall: 'long_term_memory_recall',
  agentThought: 'agent_thought',
  agentMessage: 'agent_message',
  agentAction: 'agent_action',
  datasetRetrieval: 'dataset_retrieval',
  agentEnd: 'agent_ent',
  stop: 'stop',
  error: 'error',
  timeout: 'timeout',
  ping: 'ping',
}
