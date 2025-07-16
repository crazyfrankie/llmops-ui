# 权限策略说明

## 概述

本系统采用双重认证机制：**Cookie** + **Access Token**，确保请求的安全性。

## 权限策略详情

### 1. 登录成功后的处理

- 后端返回 `access_token` 和 `expire_at`
- 前端将 `access_token` 存储到 `localStorage` 中
- 后端同时设置 `Cookie`（前端无需手动处理）

### 2. 请求认证机制

每次发起请求时，系统会自动：

1. **Cookie 处理**：
   - 通过 `credentials: 'include'` 自动携带 Cookie
   - 后端设置的 Cookie 会自动包含在所有请求中

2. **Access Token 处理**：
   - 从 `localStorage` 中获取 `access_token`
   - 将 token 添加到 `Authorization` 头部：`Bearer ${access_token}`

### 3. 权限验证失败处理

当接收到 `unauthorized` 状态码时：
- 清除本地存储的认证信息
- 自动跳转到登录页面

### 4. 退出登录处理

- 发送退出登录请求到后端（携带 Cookie 和 Authorization 头部）
- 清除本地存储的认证信息
- 后端会清除 Cookie

## 代码实现要点

### 1. 请求拦截器 (`src/utils/request.ts`)

```typescript
// 基础配置确保携带 Cookie
const baseFetchOptions = {
  credentials: 'include', // 确保每次请求都携带Cookie
  // ...其他配置
}

// 每次请求前添加 Authorization 头部
const { credential } = useCredentialStore()
const access_token = credential.access_token
if (access_token) {
  options.headers.set('Authorization', `Bearer ${access_token}`)
}
```

### 2. 认证状态检查 (`src/utils/auth.ts`)

```typescript
isLogin: (): boolean => {
  const credential = storage.get('credential')
  const now = Math.floor(Date.now() / 1000)
  
  // 检查 token 是否存在且未过期
  return credential?.access_token && credential?.expire_at > now
}
```

### 3. 登录成功处理 (`src/hooks/use-auth.ts`)

```typescript
// 登录成功后存储认证信息
await handlePasswordLogin(email, password)
credentialStore.update(authorization.value)
```

### 4. 退出登录处理 (`src/hooks/use-auth.ts`)

```typescript
// 退出时清除认证信息
const handleLogout = async () => {
  try {
    await logout() // 通知后端退出
    credentialStore.clear() // 清除本地存储
  } catch (error) {
    credentialStore.clear() // 即使请求失败也要清除本地存储
  }
}
```

## 安全特性

1. **双重认证**：Cookie + Access Token 提供更高的安全性
2. **自动过期处理**：Token 过期自动清除并跳转登录
3. **统一错误处理**：401 状态码统一处理，确保用户体验
4. **请求拦截**：所有请求统一添加认证信息，无需手动处理

## 注意事项

1. 确保后端正确设置 Cookie 的 `HttpOnly`、`Secure` 等属性
2. 前端无需手动处理 Cookie，浏览器会自动携带
3. Access Token 需要妥善存储，避免 XSS 攻击
4. 定期检查 Token 过期时间，提供良好的用户体验
