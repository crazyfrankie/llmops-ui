<script setup lang="ts">
// @ts-ignore
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { nextTick, onMounted, ref } from 'vue'
import {
  useAssistantAgentChat,
  useDeleteAssistantAgentConversation,
  useGetAssistantAgentMessagesWithPage,
  useStopAssistantAgentChat,
} from '@/hooks/use-assistant-agent'
import { useAudioToText } from '@/hooks/use-audio'
import { useGenerateSuggestedQuestions } from '@/hooks/use-ai'
import { useAccountStore } from '@/stores/account'
import AssistantAgentBackground from '@/assets/images/assistant-agent-background.png'
import { Message } from '@arco-design/web-vue'
import { QueueEvent } from '@/config'
import HumanMessage from '@/components/HumanMessage.vue'
import AiMessage from '@/components/AiMessage.vue'
import { uploadImage } from '@/services/upload-file'
import AudioRecorder from 'js-audio-recorder'

// 1.定义页面所需数据
const query = ref('')
const image_urls = ref<string[]>([])
const fileInput = ref<any>(null)
const uploadFileLoading = ref(false)
const isRecording = ref(false)  // 是否正在录音
const audioBlob = ref<any>(null)  // 录音后音频的blob
let recorder: any = null  // RecordRTC实例
const task_id = ref('')
const message_id = ref('')
const scroller = ref<any>(null)
const scrollHeight = ref(0)
const accountStore = useAccountStore()
const opening_questions = ['什么是慕课LLMOps?', '我想创建一个应用', '能介绍下什么是RAG吗?']
const { suggested_questions, handleGenerateSuggestedQuestions } = useGenerateSuggestedQuestions()
const { loading: assistantAgentChatLoading, handleAssistantAgentChat } = useAssistantAgentChat()
const {
  loading: stopAssistantAgentChatLoading,
  handleStopAssistantAgentChat, //
} = useStopAssistantAgentChat()
const {
  loading: getAssistantAgentMessagesWithPageLoading,
  messages,
  loadAssistantAgentMessages,
} = useGetAssistantAgentMessagesWithPage()
const {
  loading: deleteAssistantAgentConversationLoading,
  handleDeleteAssistantAgentConversation, //
} = useDeleteAssistantAgentConversation()
const {
  loading: audioToTextLoading,
  text,
  handleAudioToText,
} = useAudioToText()

// 2.定义保存滚动高度函数
const saveScrollHeight = () => {
  scrollHeight.value = scroller.value.$el.scrollHeight
}

// 3.定义还原滚动高度函数
const restoreScrollPosition = () => {
  scroller.value.$el.scrollTop = scroller.value.$el.scrollHeight - scrollHeight.value
}

// 4.定义滚动函数
const handleScroll = async (event: UIEvent) => {
  const { scrollTop } = event.target as HTMLElement
  if (scrollTop <= 0 && !getAssistantAgentMessagesWithPageLoading.value) {
    saveScrollHeight()
    await loadAssistantAgentMessages(false)
    restoreScrollPosition()
  }
}

// 5.定义输入框提交函数
const handleSubmit = async () => {
  // 5.1 检测是否录入了query，如果没有则结束
  if (query.value.trim() === '') {
    Message.warning('用户提问不能为空')
    return
  }

  // 5.2 检测上次提问是否结束，如果没结束不能发起新提问
  if (assistantAgentChatLoading.value) {
    Message.warning('上一次提问还未结束，请稍等')
    return
  }

  // 5.3 满足条件，处理正式提问的前置工作，涵盖：清空建议问题、删除消息id、任务id
  suggested_questions.value = []
  message_id.value = ''
  task_id.value = ''

  // 5.4 往消息列表中添加基础人类消息
  messages.value.unshift({
    id: '',
    conversation_id: '',
    query: query.value,
    image_urls: image_urls.value,
    answer: '',
    total_token_count: 0,
    latency: 0,
    agent_thoughts: [],
    ctime: 0,
  })

  // 5.5 初始化推理过程数据，并清空输入数据
  let position = 0
  const humanQuery = query.value
  const humanImageUrls = image_urls.value
  query.value = ''
  image_urls.value = []

  // 5.6 调用hooks发起请求
  await handleAssistantAgentChat(humanQuery, humanImageUrls, (event_response) => {
    // 5.7 提取流式事件响应数据以及事件名称
    const event = event_response?.event
    const data = event_response?.data
    const event_id = data?.id
    let agent_thoughts = messages.value[0].agent_thoughts

    // 5.8 初始化数据检测与赋值
    if (message_id.value === '' && data?.message_id) {
      task_id.value = data?.task_id
      message_id.value = data?.message_id
      messages.value[0].id = data?.message_id
      messages.value[0].conversation_id = data?.conversation_id
    }

    // 5.9 循环处理得到的事件，记录除ping之外的事件
    if (event !== QueueEvent.ping) {
      // 5.10 除了agent_message数据为叠加，其他均为覆盖
      if (event === QueueEvent.agentMessage) {
        // 5.11 获取数据索引并检测是否存在
        const agent_thought_idx = agent_thoughts.findIndex((item) => item?.id === event_id)

        // 5.12 数据不存在则添加
        if (agent_thought_idx === -1) {
          position += 1
          agent_thoughts.push({
            id: event_id,
            position: position,
            event: data?.event,
            thought: data?.thought,
            observation: data?.observation,
            tool: data?.tool,
            tool_input: data?.tool_input,
            latency: data?.latency,
            ctime: 0,
          })
        } else {
          // 5.13 存在数据则叠加
          agent_thoughts[agent_thought_idx] = {
            ...agent_thoughts[agent_thought_idx],
            thought: agent_thoughts[agent_thought_idx]?.thought + data?.thought,
            latency: data?.latency,
          }
        }

        // 5.14 更新/添加answer答案
        messages.value[0].answer += data?.thought
        messages.value[0].latency = data?.latency
        messages.value[0].total_token_count = data?.total_token_count
      } else if (event === QueueEvent.error) {
        // 5.15 事件为error，将错误信息(observation)填充到消息答案中进行展示
        messages.value[0].answer = data?.observation
      } else if (event === QueueEvent.timeout) {
        // 5.16 事件为timeout，则人工提示超时信息
        messages.value[0].answer = '当前Agent执行已超时，无法得到答案，请重试'
      } else {
        // 5.15 处理其他类型的事件，直接填充覆盖数据
        position += 1
        agent_thoughts.push({
          id: event_id,
          position: position,
          event: data?.event,
          thought: data?.thought,
          observation: data?.observation,
          tool: data?.tool,
          tool_input: data?.tool_input,
          latency: data?.latency,
          ctime: 0,
        })
      }

      // 5.16 更新agent_thoughts
      messages.value[0].agent_thoughts = agent_thoughts

      scroller.value.scrollToBottom()
    }
  })

  // 5.7 发起API请求获取建议问题列表
  if (message_id.value) {
    await handleGenerateSuggestedQuestions(message_id.value)
    setTimeout(() => scroller.value && scroller.value.scrollToBottom(), 100)
  }
}

// 6.定义停止调试会话函数
const handleStop = async () => {
  // 6.1 如果没有任务id或者未在加载中，则直接停止
  if (task_id.value === '' || !assistantAgentChatLoading.value) return

  // 6.2 调用api接口中断请求
  await handleStopAssistantAgentChat(task_id.value)
}

// 7.定义问题提交函数
const handleSubmitQuestion = async (question: string) => {
  // 1.将问题同步到query中
  query.value = question

  // 2.触发handleSubmit函数
  await handleSubmit()
}

// 8.定义文件上传触发器
const triggerFileInput = () => {
  // 1.检测上传的图片数量是否超过5
  if (image_urls.value.length >= 5) {
    Message.error('对话上传图片数量不能超过5张')
    return
  }

  // 2.满足条件触发上传
  fileInput.value.click()
}

// 9.定义文件变化监听器
const handleFileChange = async (event: Event) => {
  // 1.判断是否在上传中
  if (uploadFileLoading.value) return

  // 2.获取当前选中的图片
  const input = event.target as HTMLInputElement
  const selectedFile = input.files?.[0]
  if (selectedFile) {
    try {
      // 3.调用API接口上传图片
      uploadFileLoading.value = true
      const resp = await uploadImage(selectedFile)
      image_urls.value.push(resp.data.image_url)
      Message.success('上传图片成功')
    } finally {
      uploadFileLoading.value = false
    }
  }
}

// 10.开始录音处理器
const handleStartRecord = async () => {
  // 10.1 创建AudioRecorder
  recorder = new AudioRecorder()

  // 10.2 开始录音并记录录音状态
  try {
    isRecording.value = true
    await recorder.start()
    Message.success('开始录音')
  } catch (error: any) {
    Message.error(`录音失败: ${error}`)
    isRecording.value = false
  }
}

// 11.停止录音处理器
const handleStopRecord = async () => {
  if (recorder) {
    try {
      // 11.1 等待录音停止并获取录音数据
      await recorder.stop()
      audioBlob.value = recorder.getWAVBlob()

      // 11.2 调用语音转文本处理器并将文本填充到query中
      await handleAudioToText(audioBlob.value)
      query.value = text.value
    } catch (error: any) {
      Message.error(`录音失败: ${error}`)
    } finally {
      isRecording.value = false // 标记为停止录音
    }
  }
}


// 12.页面DOM加载完毕时初始化数据
onMounted(async () => {
  await loadAssistantAgentMessages(true)
  await nextTick(() => {
    // 确保在视图更新完成后执行滚动操作
    if (scroller.value) {
      scroller.value.scrollToBottom()
    }
  })
})
</script>

<template>
  <div
    class="w-full h-full min-h-screen bg-gray-100 bg-cover bg-no-repeat bg-center"
    :style="{ backgroundImage: `url(${AssistantAgentBackground})` }"
  >
    <!-- 中间页面信息 -->
    <div class="w-[600px] h-full min-h-screen mx-auto">
      <!-- 历史对话列表 -->
      <div
        v-if="messages.length > 0"
        :class="`flex flex-col px-6 ${image_urls.length > 0 ? 'h-[calc(100%-150px)] min-h-[calc(100vh-150px)]' : 'h-[calc(100%-100px)] min-h-[calc(100vh-100px)]'}`"
      >
        <dynamic-scroller
          ref="scroller"
          :items="messages.slice().reverse()"
          :min-item-size="1"
          @scroll="handleScroll"
          class="h-full scrollbar-w-none"
        >
          <template v-slot="{ item, active }">
            <dynamic-scroller-item :item="item" :active="active" :data-index="item.id">
              <div class="flex flex-col gap-6 py-6">
                <human-message :query="item.query" :image_urls="item.image_urls" :account="accountStore.account" />
                <ai-message
                  :message_id="item.id"
                  :enable_text_to_speech="true"
                  :agent_thoughts="item.agent_thoughts"
                  :answer="item.answer"
                  :app="{ name: '辅助Agent' }"
                  :suggested_questions="item.id === message_id ? suggested_questions : []"
                  :loading="item.id === message_id && assistantAgentChatLoading"
                  :latency="item.latency"
                  :total_token_count="item.total_token_count"
                  message_class="bg-white"
                  @select-suggested-question="handleSubmitQuestion"
                />
              </div>
            </dynamic-scroller-item>
          </template>
        </dynamic-scroller>
        <!-- 停止调试会话 -->
        <div
          v-if="task_id && assistantAgentChatLoading"
          class="h-[50px] flex items-center justify-center"
        >
          <a-button
            :loading="stopAssistantAgentChatLoading"
            class="rounded-lg px-2"
            @click="handleStop"
          >
            <template #icon>
              <icon-poweroff />
            </template>
            停止响应
          </a-button>
        </div>
      </div>
      <!-- 对话列表为空时展示的对话开场白 -->
      <div
        v-else
        :class="`flex flex-col p-6 gap-2 items-center justify-center overflow-scroll scrollbar-w-none ${image_urls.length > 0 ? 'h-[calc(100%-150px)] min-h-[calc(100vh-150px)]' : 'h-[calc(100%-100px)] min-h-[calc(100vh-100px)]'}`"
      >
        <div class="mb-9">
          <div class="text-[40px] font-bold text-gray-700 mt-[52px] mb-4">
            Hi，我是慕课 AI 应用构建器
          </div>
          <div class="text-[30px] font-bold text-gray-700 mb-2">
            你的专属
            <span class="text-blue-700">AI 原生应用</span>
            开发平台
          </div>
          <div class="text-base text-gray-700">
            说出你的创意，我可以快速帮你创建专属应用，一键轻松分享给朋友，也可以一键发布到慕课
            LLMOps 平台、微信等多个渠道。
          </div>
        </div>
        <!-- 开场AI对话消息 -->
        <div class="flex gap-2">
          <!-- 左侧图标 -->
          <a-avatar :size="30" shape="circle" class="flex-shrink-0 bg-blue-700">
            <icon-apps />
          </a-avatar>
          <!-- 右侧名称与消息 -->
          <div class="flex flex-col items-start gap-2">
            <!-- 应用名称 -->
            <div class="text-gray-700 font-bold">辅助Agent</div>
            <!-- AI消息 -->
            <div
              class="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-2xl break-all leading-7"
            >
              <div class="font-bold">你好，欢迎来到慕课LLMOps🎉</div>
              <div class="">
                慕课LLMOps是新一代大模型 AI 应用开发平台。无论你是否有编程基础，都可以快速搭建出各种
                AI 应用，并一键发布到各大社交平台，或者轻松部署到自己的网站。
              </div>
              <ul class="list-disc pl-6">
                <li>
                  随时来
                  <router-link :to="{ name: 'store-apps-list' }" class="text-blue-700"
                  >应用广场
                  </router-link>
                  逛逛，这里内置了许多超有趣的应用。
                </li>
                <li>你也可以直接发送“我想做一个应用”，我可以帮你快速创建应用。</li>
                <li>你也可以向我提问有关课程的问题，我可以快速替你解答。</li>
              </ul>
              <div class="">如果你还有其他慕课LLMOps使用问题，也欢迎随时问我！</div>
            </div>
            <!-- 开场白建议问题 -->
            <div class="flex flex-col gap-2">
              <div
                v-for="(opening_question, idx) in opening_questions"
                :key="idx"
                class="px-4 py-1.5 border rounded-lg text-gray-700 cursor-pointer bg-white hover:bg-gray-50"
                @click="async () => await handleSubmitQuestion(opening_question)"
              >
                {{ opening_question }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 对话输入框 -->
      <div class="w-full flex flex-col flex-shrink-0">
        <!-- 顶部输入框 -->
        <div class="px-6 flex items-center gap-4">
          <!-- 清除按钮 -->
          <a-button
            :loading="deleteAssistantAgentConversationLoading"
            class="flex-shrink-0 !text-gray-700"
            type="text"
            shape="circle"
            @click="
              async () => {
                // 1.先调用停止响应接口
                await handleStop()

                // 2.调用api接口清空会话
                await handleDeleteAssistantAgentConversation()

                // 3.重新获取数据
                await loadAssistantAgentMessages(true)
              }
            "
          >
            <template #icon>
              <icon-empty :size="16" />
            </template>
          </a-button>
          <!-- 输入框组件 -->
          <div
            :class="`bg-white ${image_urls.length > 0 ? 'h-[100px]' : 'h-[50px]'} flex flex-col justify-center gap-2 px-4 flex-1 border border-gray-200 rounded-[24px]`"
          >
            <!-- 图片列表 -->
            <div v-if="image_urls.length > 0" class="flex items-center gap-2">
              <div
                v-for="(image_url, idx) in image_urls"
                :key="image_url"
                class="w-10 h-10 relative rounded-lg overflow-hidden group cursor-pointer">
                <a-avatar
                  shape="square"
                  :image-url="image_url"
                />
                <div
                  class="hidden group-hover:flex items-center justify-center bg-gray-700/50 w-10 h-10 absolute top-0"
                >
                  <icon-close class="text-white" @click="() => image_urls.splice(idx, 1)" />
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model="query"
                type="text"
                class="flex-1 outline-0"
                placeholder="发送消息或创建AI应用..."
                @keyup.enter="handleSubmit"
              />
              <!-- 上传图片输入框 -->
              <input type="file" ref="fileInput" accept="image/*" @change="handleFileChange" class="hidden" />
              <a-button
                :loading="uploadFileLoading"
                size="mini"
                type="text"
                shape="circle"
                class="!text-gray-700"
                @click="triggerFileInput"
              >
                <template #icon>
                  <icon-plus />
                </template>
              </a-button>
              <!-- 语音转文本加载按钮 -->
              <template v-if="audioToTextLoading">
                <a-button
                  size="mini"
                  type="text"
                  shape="circle"
                >
                  <template #icon>
                    <icon-loading />
                  </template>
                </a-button>
              </template>
              <template v-else>
                <!-- 开始音频录制按钮 -->
                <a-button
                  v-if="!isRecording"
                  size="mini"
                  type="text"
                  shape="circle"
                  class="!text-gray-700"
                  @click="handleStartRecord"
                >
                  <template #icon>
                    <icon-voice />
                  </template>
                </a-button>
                <!-- 结束音频录制按钮 -->
                <a-button
                  v-else
                  size="mini"
                  type="text"
                  shape="circle"
                  @click="handleStopRecord"
                >
                  <template #icon>
                    <icon-pause />
                  </template>
                </a-button>
              </template>
              <a-button
                :loading="assistantAgentChatLoading"
                size="mini"
                type="text"
                shape="circle"
                class="!text-gray-700"
                @click="handleSubmit"
              >
                <template #icon>
                  <icon-send :size="16" />
                </template>
              </a-button>
            </div>
          </div>
        </div>
        <!-- 底部提示信息 -->
        <div class="text-center text-gray-500 text-xs py-4">
          内容由AI生成，无法确保真实准确，仅供参考。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
