<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { debugApp } from '@/services/app.ts'

const query = ref('')
const messages = ref([])
const isLoading = ref(false)
const route = useRoute()

const clearMessage = () => {
  messages.value = []
}

const send = async () => {
  if (!query.value) {
    Message.error('用户提问不能为空')
    return
  }
  if (isLoading.value) {
    Message.warning('上一次回复还未结束，请等待')
    return
  }

  try {
    const humanQuery = query.value
    messages.value.push({
      role: 'human',
      content: humanQuery,
    })
    query.value = ''
    isLoading.value = true

    const response = await debugApp(route.params.app_id as string, humanQuery)
    const content = response.data.content

    messages.value.push({
      role: 'ai',
      content: content,
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full">
    <header class="flex items-center h-[74px] bg-gray-100 border-b border-gray-200 px-4">
      顶部导航
    </header>
    <div class="flex flex-row h-[calc(100vh-74px)]">
      <div class="w-2/3 bg-gray-50 h-full flex flex-col">
        <header class="flex items-center h-16 border-b border-gray-200 px-7 text-xl text-gray-700">
          应用编排
        </header>
        <div class="flex flex-row h-[calc(100%-64px)]">
          <div class="flex-1 border-r border-gray-200 p-6">人设与回复逻辑</div>
          <div class="flex-1 p-6">应用能力</div>
        </div>
      </div>
      <div class="flex flex-col w-1/3 bg-white h-full">
        <header
          class="flex flex-shrink-0 items-center h-16 px-4 text-xl bg-white border-b border-gray-200 shadow-sm"
        >
          调试与预览
        </header>
        <div class="h-full min-h-0 px-6 py-7 overflow-x-hidden overflow-y-scroll scrollbar-w-none">
          <!-- 人类消息 -->
          <div class="flex flex-row gap-2 mb-6" v-for="message in messages" :key="message.content">
            <!-- 头像 -->
            <a-avatar
              v-if="message.role === 'human'"
              class="flex-shrink-0"
              :size="30"
              :style="{ backgroundColor: '#3370ff' }"
              >慕</a-avatar
            >
            <a-avatar
              v-else
              class="flex-shrink-0"
              :size="30"
              :style="{ backgroundColor: '#00d0b6' }"
            >
              <icon-apps />
            </a-avatar>

            <!-- 实际消息 -->
            <div class="flex flex-col gap-2">
              <div class="font-semibold text-gray-700">
                {{ message.role === 'human' ? '慕小课' : 'ChatGPT' }}
              </div>
              <div
                v-if="message.role === 'human'"
                class="max-w-max bg-blue-700 text-white border border-blue-800 px-4 py-3 rounded-2xl leading-5"
              >
                {{ message.content }}
              </div>
              <div
                v-else
                class="max-w-maxbg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
              >
                {{ message.content }}
              </div>
            </div>
          </div>
          <!-- 没有任何数据时 -->
          <div
            v-if="!messages.length"
            class="mt-[200px] flex flex-col items-center justify-center gap-2"
          >
            <a-avatar :size="70" shape="square" :style="{ backgroundColor: '#00d0b6' }">
              <icon-apps />
            </a-avatar>
            <div class="text-2xl font-semibold text-gray-900 mt-2">ChatGPT</div>
          </div>
          <!-- AI 加载状态 -->
          <div v-if="isLoading" class="flex flex-row gap-2 mb-6">
            <a-avatar class="flex-shrink-0" :size="30" :style="{ backgroundColor: '#00d0b6' }">
              <icon-apps />
            </a-avatar>
            <div class="flex flex-col gap-2">
              <div class="font-semibold text-gray-700">ChatGPT</div>
              <div
                class="max-w-max bg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
              >
                <icon-loading />
              </div>
            </div>
          </div>
        </div>
        <!-- 调试对话输入框 -->
        <div class="w-full flex-shrink-0 flex flex-col">
          <!-- 顶部输入框 -->
          <div class="px-6 flex items-center gap-4">
            <!-- 清除按钮 -->
            <a-button class="flex-shrink-0" type="text" shape="circle" @click="clearMessage">
              <template #icon>
                <icon-empty size="16" :style="{ color: '#374151' }" />
              </template>
            </a-button>
            <!-- 输入框 -->
            <div
              class="h-[50px] flex items-center gap-2 px-4 flex-1 border border-gray-200 rounded-full"
            >
              <input type="text" class="flex-1 outline-0" v-model="query" @keyup.enter="send" />
              <!-- 添加按钮 -->
              <a-button type="text" shape="circle">
                <template #icon>
                  <icon-plus-circle size="16" :style="{ color: '#374151' }" />
                </template>
              </a-button>
              <!-- 发送按钮 -->
              <a-button type="text" shape="circle">
                <template #icon>
                  <icon-send size="16" :style="{ color: '#1d4ed8' }" @click="send" />
                </template>
              </a-button>
            </div>
          </div>
          <!-- 底部提示文字 -->
          <div class="text-center text-gray-500 text-xs py-4">
            内容由 AI 生成，无法确保真实准确，仅供参考
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
