<script setup lang="ts">
import moment from 'moment/moment'
import {useCopyApp, useDeleteApp, useGetAppsWithPage} from '@/hooks/use-app'
import {onMounted, ref, watch} from 'vue'
import {useAccountStore} from '@/stores/account'
import CreateOrUpdateAppModal from './components/CreateOrUpdateAppModal.vue'
import {useRoute} from 'vue-router'

// 1.定义页面所需数据
const route = useRoute()
const props = defineProps({
  createType: {type: String, default: '', required: true},
})
const emits = defineEmits(['update:create-type'])
const createOrUpdateAppModalVisible = ref(false)
const updateAppId = ref('')
const accountStore = useAccountStore()
const {handleCopyApp} = useCopyApp()
const {loading: getAppsWithPageLoading, apps, paginator, loadApps} = useGetAppsWithPage()
const {handleDeleteApp} = useDeleteApp()

// 2.定义滚动数据分页处理器
const handleScroll = async (event: UIEvent) => {
  // 1.获取滚动距离、可滚动的最大距离、客户端/浏览器窗口的高度
  const {scrollTop, scrollHeight, clientHeight} = event.target as HTMLElement

  // 2.判断是否滑动到底部
  if (scrollTop + clientHeight >= scrollHeight - 10) {
    if (getAppsWithPageLoading.value) return
    await loadApps(false, String(route.query?.search_word ?? ''))
  }
}

// 页面DOM加载完毕后执行
onMounted(async () => {
  // 初始化apps数据
  await loadApps(true, String(route.query?.search_word ?? ''))
})

watch(
    () => props.createType,
    (newValue) => {
      if (newValue === 'app') {
        updateAppId.value = ''
        createOrUpdateAppModalVisible.value = true
        emits('update:create-type', '')
      }
    },
)

watch(
    () => route.query?.search_word,
    (newValue) => loadApps(true, String(newValue)),
)

watch(
    () => route.query?.create_type,
    (newValue) => {
      if (newValue === 'app') {
        updateAppId.value = ''
        createOrUpdateAppModalVisible.value = true
      }
    },
    {immediate: true},
)
</script>

<template>
  <a-spin
      :loading="getAppsWithPageLoading"
      class="block h-full w-full scrollbar-w-none overflow-scroll"
      @scroll="handleScroll"
  >
    <!-- 底部应用列表 -->
    <a-row :gutter="[20, 20]" class="flex-1">
      <!-- 有数据的UI状态 -->
      <a-col v-for="app in apps" :key="app.id" :span="6">
        <a-card hoverable class="cursor-pointer rounded-lg">
          <!-- 顶部应用名称 -->
          <div class="flex items-center gap-3 mb-3">
            <!-- 左侧图标 -->
            <a-avatar :size="40" shape="square" :image-url="app.icon"/>
            <!-- 右侧App信息 -->
            <div class="flex flex-1 justify-between">
              <div class="flex flex-col">
                <router-link
                    :to="{
                    name: 'space-apps-detail',
                    params: { app_id: app.id },
                  }"
                    class="text-base text-gray-900 font-bold"
                >
                  {{ app.name }}
                  <icon-check-circle-fill
                      v-if="app.status === 'published'"
                      class="text-green-700"
                  />
                </router-link>
                <div class="text-xs text-gray-500 line-clamp-1">
                  {{ app.model_config.provider }} · {{ app.model_config.model }}
                </div>
              </div>
              <!-- 操作按钮 -->
              <a-dropdown position="br">
                <a-button type="text" size="small" class="rounded-lg !text-gray-700">
                  <template #icon>
                    <icon-more/>
                  </template>
                </a-button>
                <template #content>
                  <router-link :to="{ name: 'space-apps-analysis', params: { app_id: app.id } }">
                    <a-doption>分析</a-doption>
                  </router-link>
                  <a-doption
                      @click="
                      () => {
                        updateAppId = app.id
                        createOrUpdateAppModalVisible = true
                      }
                    "
                  >
                    编辑应用
                  </a-doption>
                  <a-doption @click="async () => await handleCopyApp(app.id)">创建副本</a-doption>
                  <a-doption
                      class="text-red-700"
                      @click="
                      () =>
                        handleDeleteApp(
                          app.id,
                          async () => await loadApps(true, String(route.query?.search_word ?? '')),
                        )
                    "
                  >
                    删除
                  </a-doption>
                </template>
              </a-dropdown>
            </div>
          </div>
          <!-- App的描述信息 -->
          <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2 break-all">
            {{ app.description.trim() === '' ? app.preset_prompt : app.description }}
          </div>
          <!-- 应用的归属者信息 -->
          <div class="flex items-center gap-1.5">
            <a-avatar :size="18" class="bg-blue-700">
              <icon-user/>
            </a-avatar>
            <div class="text-xs text-gray-400">
              {{ accountStore.account.name }} · 最近编辑
              {{ moment(app.utime * 1000).format('MM-DD HH:mm') }}
            </div>
          </div>
        </a-card>
      </a-col>
      <!-- 没数据的UI状态 -->
      <a-col v-if="apps.length === 0" :span="24">
        <a-empty
            description="没有可用的Agent智能体"
            class="h-[400px] flex flex-col items-center justify-center"
        />
      </a-col>
    </a-row>
    <!-- 加载器 -->
    <a-row v-if="paginator.total_page >= 2">
      <!-- 加载数据中 -->
      <a-col v-if="paginator.current_page <= paginator.total_page" :span="24" align="center">
        <a-space class="my-4">
          <a-spin/>
          <div class="text-gray-400">加载中</div>
        </a-space>
      </a-col>
      <!-- 数据加载完成 -->
      <a-col v-else :span="24" align="center">
        <div class="text-gray-400 my-4">数据已加载完成</div>
      </a-col>
    </a-row>
    <!-- 新建/修改模态窗 -->
    <create-or-update-app-modal
        v-model:visible="createOrUpdateAppModalVisible"
        v-model:app_id="updateAppId"
        :callback="() => loadApps(true, String(route.query?.search_word ?? ''))"
    />
  </a-spin>
</template>

<style scoped></style>
