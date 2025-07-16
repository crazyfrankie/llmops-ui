import { type BaseResponse } from '@/models/base'

// 账号密码登录响应结构
export type PasswordLoginResponse = BaseResponse<any> & {
  access_token?: string // 从响应头部获取的access_token
  headers?: Record<string, string> // 响应头部信息
}
