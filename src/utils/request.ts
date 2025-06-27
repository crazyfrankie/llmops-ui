import { apiPrefix, httpCode } from '@/config'
import { Message } from '@arco-design/web-vue'

// 超时时间100s
const TIME_OUT = 100000

// Fetch请求参数类型
type FetchOptionType = Omit<RequestInit, 'body'> & {
  params?: Record<string, any>
  body?: BodyInit | Record<string, any> | null
}

// Fetch请求基础配置
const baseFetchOptions = {
  method: 'GET',
  mode: 'cors',
  credentials: 'include', // 每次都携带cookie、Http基础验证信息
  headers: new Headers({
    'Content-Type': 'application/json',
  }),
  redirect: 'follow',
}
// 封装基础fetch函数
const baseFetch = <T>(url: string, fetchOptions: FetchOptionType): Promise<T> => {
  // 1.获取传递的所有配置
  const options: typeof baseFetchOptions & FetchOptionType = Object.assign(
    {},
    baseFetchOptions,
    fetchOptions,
  )

  // 2.计算实际请求发起的URL地址
  let urlWithPrefix = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`

  // 3.解构请求的method、params、body
  const { method, params, body } = options

  // 4.如果方法为GET并传递了参数，则处理参数信息
  if (method === 'GET' && params) {
    const paramsArray: string[] = []
    Object.keys(params).forEach((key) => {
      paramsArray.push(`${key}=${encodeURIComponent(params[key])}`)
    })
    if (urlWithPrefix.search(/\?/) === -1) {
      urlWithPrefix += `?${paramsArray.join('&')}`
    } else {
      urlWithPrefix += `&${paramsArray.join('&')}`
    }

    // 5.删除params参数
    delete options.params
  }

  // 6.处理传递的post参数
  if (body) options.body = JSON.stringify(body)

  // 7.构建超时处理
  return Promise.race([
    // 超时Promise
    new Promise((reject) => {
      setTimeout(() => {
        reject('请求超时')
      }, TIME_OUT)
    }),
    // 正常接口响应
    new Promise((resolve, reject) => {
      globalThis
        .fetch(urlWithPrefix, options as RequestInit)
        .then(async (res) => {
          const json = await res.json()
          if (json.code == httpCode.success) {
            resolve(json)
          } else {
            Message.error(json.message)
            reject(new Error(json.message))
          }
        })
        .catch((err) => {
          Message.error(err.message)
          reject(err)
        })
    }),
  ]) as Promise<T>
}

// 封装基础的fetch请求
export const request = <T>(url: string, options = {}) => {
  return baseFetch<T>(url, options)
}

// 封装基础的get请求
export const get = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'GET' }))
}

// 封装基础的post请求
export const post = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'POST' }))
}
