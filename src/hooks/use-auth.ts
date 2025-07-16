import { ref } from 'vue'
import { logout, passwordLogin } from '@/services/auth'
import { Message } from '@arco-design/web-vue'
import { useCredentialStore } from '@/stores/credential'

export const useLogout = () => {
  // 1.定义hooks所需数据
  const loading = ref(false)
  const credentialStore = useCredentialStore()

  // 2.定义退出登录处理器
  const handleLogout = async () => {
    try {
      loading.value = true
      const resp = await logout()
      // 清除本地存储的凭证信息
      credentialStore.clear()
      Message.success(resp.message)
    } catch (error) {
      // 即使退出登录失败，也要清除本地凭证
      credentialStore.clear()
      Message.error('退出登录失败')
    } finally {
      loading.value = false
    }
  }

  return { loading, handleLogout }
}

export const usePasswordLogin = () => {
  // 1.定义hooks所需数据
  const loading = ref(false)
  const authorization = ref<Record<string, any>>({})

  // 2.定义账号密码处理器
  const handlePasswordLogin = async (email: string, password: string) => {
    try {
      loading.value = true
      const resp = await passwordLogin(email, password)
      
      // 检查是否登录成功（code为success且存在access_token）
      if (resp.code === 20000 && resp.access_token) {
        // 设置token过期时间（假设为7天，实际应根据后端配置）
        const expire_at = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        
        authorization.value = {
          access_token: resp.access_token,
          expire_at: expire_at,
        }
      } else {
        throw new Error('登录失败：未获取到有效的access_token')
      }
    } finally {
      loading.value = false
    }
  }

  return { loading, authorization, handlePasswordLogin }
}
