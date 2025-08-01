<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { cloneDeep } from 'lodash'
import { Message, type ValidatedError } from '@arco-design/web-vue'
import { getReferencedVariables } from '@/utils/helper'
import ModelConfig from './components/ModelConfig.vue'

// 1.定义自定义组件所需数据
const props = defineProps({
  visible: { type: Boolean, required: true, default: false },
  node: {
    type: Object,
    required: true,
    default: () => {
      return {}
    },
  },
  loading: { type: Boolean, required: true, default: false },
})
const emits = defineEmits(['update:visible', 'updateNode'])
const { nodes, edges } = useVueFlow()
const form = ref<Record<string, any>>({})

// 2.定义节点可引用的变量选项
const inputRefOptions = computed(() => {
  return getReferencedVariables(cloneDeep(nodes.value), cloneDeep(edges.value), props.node.id)
})

// 3.定义添加表单输入字段函数
const addFormInputField = () => {
  // 3.1[功能升级] 内容默认设置为null避免字段类型切换错误
  form.value?.inputs.push({ name: '', type: 'string', content: null, ref: '' })
  Message.success('新增输入字段成功')
}

// 3.定义移除表单输入字段函数
const removeFormInputField = (idx: number) => {
  form.value?.inputs?.splice(idx, 1)
}

// 4.定义表单提交函数
const onSubmit = async ({ errors }: { errors: Record<string, ValidatedError> | undefined }) => {
  // 4.1 检查表单是否出现错误，如果出现错误则直接结束
  if (errors) return

  // 4.2 深度拷贝表单数据内容
  const cloneInputs = cloneDeep(form.value.inputs)

  // 4.3 数据校验通过，通过事件触发数据更新
  emits('updateNode', {
    id: props.node.id,
    title: form.value.title,
    description: form.value.description,
    prompt: form.value.prompt,
    model_config: form.value.model_config,
    inputs: cloneInputs.map((input: any) => {
      return {
        name: input.name,
        description: '',
        required: true,
        type: input.type === 'ref' ? 'string' : input.type,
        value: {
          type: input.type === 'ref' ? 'ref' : 'literal',
          content:
            input.type === 'ref'
              ? {
                ref_node_id: input.ref.split('/')[0] || '',
                ref_var_name: input.ref.split('/')[1] || '',
              }
              : input.content,
        },
        meta: {},
      }
    }),
    outputs: cloneDeep(form.value.outputs),
  })
}

// 5.监听数据，将数据映射到表单模型上
watch(
  () => props.node,
  (newNode) => {
    const cloneInputs = cloneDeep(newNode.data.inputs)
    form.value = {
      id: newNode.id,
      type: newNode.type,
      title: newNode.data.title,
      description: newNode.data.description,
      prompt: newNode.data.prompt,
      model_config: newNode.data.language_model_config,
      inputs: cloneInputs.map((input: any) => {
        // 5.1 计算引用的变量值信息
        const ref =
          input.value.type === 'ref'
            ? `${input.value.content.ref_node_id}/${input.value.content.ref_var_name}`
            : ''

        // 5.2 判断引用的变量值信息是否存在，如果不存在则设置为空
        let refExists = false
        if (input.value.type === 'ref') {
          for (const inputRefOption of inputRefOptions.value) {
            for (const option of inputRefOption.options) {
              if (option.value === ref) {
                refExists = true
                break
              }
            }
          }
        }
        return {
          name: input.name, // 变量名
          type: input.value.type === 'literal' ? input.type : 'ref', // 数据类型(涵盖ref/string/int/float/boolean
          content: input.value.type === 'literal' ? input.value.content : '', // 变量值内容
          ref: input.value.type === 'ref' && refExists ? ref : '', // 变量引用信息，存储引用节点id+引用变量名
        }
      }),
      outputs: [{ name: 'output', type: 'string', value: { type: 'generated', content: '' } }],
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="props.visible"
    id="llm-node-info"
    class="absolute top-0 right-0 bottom-0 w-[400px] border-l z-50 bg-white overflow-scroll scrollbar-w-none p-3"
  >
    <!-- 顶部标题信息 -->
    <div class="flex items-center justify-between gap-3 mb-2">
      <!-- 左侧标题 -->
      <div class="flex items-center gap-1 flex-1">
        <a-avatar :size="30" shape="square" class="bg-sky-500 rounded-lg flex-shrink-0">
          <icon-language />
        </a-avatar>
        <a-input
          v-model:model-value="form.title"
          placeholder="请输入标题"
          class="!bg-white text-gray-700 font-semibold px-2"
        />
      </div>
      <!-- 右侧关闭按钮 -->
      <a-button
        type="text"
        size="mini"
        class="!text-gray700 flex-shrink-0"
        @click="() => emits('update:visible', false)"
      >
        <template #icon>
          <icon-close />
        </template>
      </a-button>
    </div>
    <!-- 描述信息 -->
    <a-textarea
      :auto-size="{ minRows: 3, maxRows: 5 }"
      v-model="form.description"
      class="rounded-lg text-gray-700 !text-xs"
      placeholder="输入描述..."
    />
    <!-- 分隔符 -->
    <a-divider class="my-2" />
    <!-- 表单信息 -->
    <a-form size="mini" :model="form" layout="vertical" @submit="onSubmit">
      <!-- 模型选择 -->
      <div class="flex flex-col gap-2">
        <!-- 标题&操作按钮 -->
        <div class="flex items-center justify-between">
          <!-- 左侧标题 -->
          <div class="flex items-center gap-2 text-gray-700 font-semibold">
            <div class="">语言模型配置</div>
            <a-tooltip content="选择不同的大语言模型作为节点的底座模型">
              <icon-question-circle />
            </a-tooltip>
          </div>
          <!-- 右侧选择模型 -->
          <model-config v-model:model_config="form.model_config" />
        </div>
      </div>
      <a-divider class="my-4" />
      <!-- 输入参数 -->
      <div class="flex flex-col gap-2">
        <!-- 标题&操作按钮 -->
        <div class="flex items-center justify-between">
          <!-- 左侧标题 -->
          <div class="flex items-center gap-2 text-gray-700 font-semibold">
            <div class="">输入数据</div>
            <a-tooltip
              content="输入给大模型的参数，可在下方提示词中引用。所有输入参数会被转为string输入。"
            >
              <icon-question-circle />
            </a-tooltip>
          </div>
          <!-- 右侧新增字段按钮 -->
          <a-button
            type="text"
            size="mini"
            class="!text-gray-700"
            @click="() => addFormInputField()"
          >
            <template #icon>
              <icon-plus />
            </template>
          </a-button>
        </div>
        <!-- 字段名 -->
        <div class="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <div class="w-[20%]">参数名</div>
          <div class="w-[25%]">类型</div>
          <div class="w-[47%]">值</div>
          <div class="w-[8%]"></div>
        </div>
        <!-- 循环遍历字段列表 -->
        <div v-for="(input, idx) in form?.inputs" :key="idx" class="flex items-center gap-1">
          <div class="w-[20%] flex-shrink-0">
            <a-input v-model="input.name" size="mini" placeholder="请输入参数名" class="!px-2" />
          </div>
          <div class="w-[25%] flex-shrink-0">
            <a-select
              size="mini"
              v-model="input.type"
              class="px-2"
              :options="[
                { label: '引用', value: 'ref' },
                { label: 'STRING', value: 'string' },
                { label: 'INT', value: 'int' },
                { label: 'FLOAT', value: 'float' },
                { label: 'BOOLEAN', value: 'boolean' },
                { label: 'LIST[STRING]', value: 'list[string]' },
                { label: 'LIST[INT]', value: 'list[int]' },
                { label: 'LIST[FLOAT]', value: 'list[float]' },
                { label: 'LIST[BOOLEAN]', value: 'list[boolean]' },
              ]"
            />
          </div>
          <div class="w-[47%] flex-shrink-0 flex items-center gap-1">
            <a-input-tag
              v-if="input.type.startsWith('list')"
              size="mini"
              v-model="input.content"
              :default-value="[]"
              placeholder="请输入参数值，按回车结束"
            />
            <a-input
              v-else-if="input.type !== 'ref'"
              size="mini"
              v-model="input.content"
              placeholder="请输入参数值"
            />
            <a-select
              v-else
              placeholder="请选择引用变量"
              size="mini"
              tag-nowrap
              v-model="input.ref"
              :options="inputRefOptions"
            />
          </div>
          <div class="w-[8%] text-right">
            <icon-minus-circle
              class="text-gray-500 hover:text-gray-700 cursor-pointer flex-shrink-0"
              @click="() => removeFormInputField(idx)"
            />
          </div>
        </div>
        <!-- 空数据状态 -->
        <a-empty v-if="form?.inputs.length <= 0" class="my-4">该节点暂无输入数据</a-empty>
      </div>
      <a-divider class="my-4" />
      <!-- 提示词 -->
      <div class="flex flex-col gap-2">
        <!-- 标题&操作按钮 -->
        <div class="flex items-center justify-between">
          <!-- 左侧标题 -->
          <div class="flex items-center gap-2 text-gray-700 font-semibold">
            <div class="">提示词</div>
            <a-tooltip
              content="作为人类消息传递给大语言模型，可以使用{{参数名}}插入引用/创建的变量。"
            >
              <icon-question-circle />
            </a-tooltip>
          </div>
        </div>
        <!-- 提示词输入框 -->
        <a-form-item field="prompt" hide-label hide-asterisk required>
          <a-textarea
            :auto-size="{ minRows: 5, maxRows: 10 }"
            v-model="form.prompt"
            placeholder="编写大模型的提示词，使大模型实现对应的功能。通过插入{{参数名}}可以引用对应的参数值。"
            class="rounded-lg"
          />
        </a-form-item>
      </div>
      <a-divider class="my-4" />
      <!-- 输出参数 -->
      <div class="flex flex-col gap-2">
        <!-- 输出标题 -->
        <div class="font-semibold text-gray-700">输出数据</div>
        <!-- 字段标题 -->
        <div class="text-gray-500 text-xs">参数名</div>
        <!-- 输出参数列表 -->
        <div v-for="(output, idx) in form?.outputs" :key="idx" class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="text-gray-700">{{ output.name }}</div>
            <div class="text-gray-500 bg-gray-200 px-1 py-0.5 rounded">{{ output.type }}</div>
          </div>
        </div>
      </div>
      <a-divider class="my-4" />
      <!-- 保存按钮 -->
      <a-button
        :loading="props.loading"
        type="primary"
        size="small"
        html-type="submit"
        long
        class="rounded-lg"
      >
        保存
      </a-button>
    </a-form>
  </div>
</template>

<style scoped></style>
