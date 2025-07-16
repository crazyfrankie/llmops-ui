import { post } from '@/utils/request'
import { type BaseResponse } from '@/models/base'
import { type PasswordLoginResponse } from '@/models/auth'

// 账号密码登录请求
export const passwordLogin = (email: string, password: string) => {
  return post<PasswordLoginResponse>(`/auth/login`, {
    body: { email, password },
    // 需要返回响应头部信息以获取access_token
    includeHeaders: true,
  })
}

// 退出登录请求
export const logout = () => {
  return post<BaseResponse<any>>(`/auth/logout`, {
    // 确保退出登录时也携带Cookie和Authorization头部
  })
}
