<template>
  <div class="ops-deploy-product">
    <el-form label-position="top">
      <el-form-item label="部署产品">
        <el-select v-model="config.product" style="width: 320px">
          <el-option
            v-for="item in productOptions"
            :key="item.id"
            :label="productLabel(item)"
            :value="item.id"
          />
        </el-select>
        <p class="ops-deploy-hint">{{ currentMeta.description }}</p>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="currentMeta.status === 'demo'"
      type="info"
      show-icon
      :closable="false"
      class="ops-deploy-alert"
      title="该产品本期只演示配置模块，一键部署走 mock，不会登录云厂商。"
    />

    <el-alert
      v-if="config.product === 'agentrun'"
      type="warning"
      show-icon
      :closable="false"
      class="ops-deploy-alert"
    >
      <template #title>AgentRun 前置条件（控制台完成，无法在此开通）</template>
      <ul class="ops-prereq">
        <li>RAM 子用户已授 AliyunAgentRunFullAccess</li>
        <li>VPC / RDS(fitness_agent) / NAS / SLS / Workspace 已建好</li>
        <li>运行时角色 AliyunAgentRunDefaultRole（yaml 固定）</li>
        <li>发版后到 AgentRun 控制台关闭会话亲和</li>
      </ul>
    </el-alert>

    <el-collapse v-if="config.product === 'agentrun'" v-model="open">
      <el-collapse-item title="账号（原本地 ~/.s/access.yaml）" name="account">
        <el-form label-position="top">
          <el-form-item>
            <template #label>
              <span>阿里云主账号 UID</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input
              v-model="ar.account.account_id"
              placeholder="约 16 位数字，例如 1234567890123456"
            />
            <p class="ops-field-tip">{{ tips.account_id }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>AccessKey ID</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input v-model="ar.account.access_key_id" placeholder="RAM 子用户 AK ID" />
            <p class="ops-field-tip">{{ tips.access_key_id }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>AccessKey Secret</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input v-model="ar.account.access_key_secret" type="password" show-password />
            <p class="ops-field-tip">{{ tips.access_key_secret }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>Serverless Devs 别名（SD_ACCESS）</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input v-model="ar.account.sd_access" placeholder="fitness-prod" />
            <p class="ops-field-tip">{{ tips.sd_access }}</p>
          </el-form-item>
        </el-form>
      </el-collapse-item>
      <el-collapse-item title="AgentRun 平台" name="platform">
        <el-form label-position="top">
          <el-form-item label="目标环境">
            <el-radio-group v-model="ar.target_env">
              <el-radio-button label="prod">prod</el-radio-button>
              <el-radio-button label="test">test</el-radio-button>
            </el-radio-group>
            <p class="ops-field-tip">{{ tips.target_env }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>地域</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input v-model="ar.platform.region" placeholder="cn-hangzhou" />
            <p class="ops-field-tip">{{ tips.region }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>Workspace ID</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-input v-model="ar.platform.workspace_id" placeholder="AgentRun 工作空间 ID" />
            <p class="ops-field-tip">{{ tips.workspace_id }}</p>
          </el-form-item>
          <el-form-item label="Agent 名称">
            <el-input v-model="ar.platform.agent_name" />
            <p class="ops-field-tip">{{ tips.agent_name }}</p>
          </el-form-item>
          <el-form-item label="Endpoint 名称">
            <el-input v-model="ar.platform.endpoint_name" />
            <p class="ops-field-tip">{{ tips.endpoint_name }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>Node 运行时版本</span>
              <span class="ops-field-req">必填</span>
            </template>
            <el-radio-group v-model="ar.platform.code_language">
              <el-radio-button
                v-for="item in codeLanguageOptions"
                :key="item.value"
                :label="item.value"
              >
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
            <p class="ops-field-tip">{{ tips.code_language }}</p>
          </el-form-item>
          <el-form-item label="调用根地址 AGENT_BASE_URL">
            <el-input v-model="ar.platform.agent_base_url" placeholder="https://…" />
            <p class="ops-field-tip">{{ tips.agent_base_url }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span>VPC / 交换机 / 安全组</span>
              <span class="ops-field-req">必填</span>
            </template>
            <div class="ops-field-row">
              <el-input v-model="ar.platform.vpc_id" placeholder="vpc-…" />
              <el-input v-model="ar.platform.vswitch_id" placeholder="vsw-…" />
              <el-input v-model="ar.platform.security_group_id" placeholder="sg-…" />
            </div>
            <p class="ops-field-tip">{{ tips.vpc_id }}</p>
          </el-form-item>
          <el-form-item label="NAS 地址">
            <el-input v-model="ar.platform.nas_server_addr" />
            <p class="ops-field-tip">{{ tips.nas_server_addr }}</p>
          </el-form-item>
          <el-form-item label="SLS 项目 / Logstore">
            <div class="ops-field-row">
              <el-input v-model="ar.platform.log_project" placeholder="LOG_PROJECT" />
              <el-input v-model="ar.platform.log_store" placeholder="LOG_STORE" />
            </div>
            <p class="ops-field-tip">{{ tips.log_project }}</p>
          </el-form-item>
        </el-form>
      </el-collapse-item>
      <el-collapse-item title="运行时密钥与业务地址（原 deploy/config/.env.prod）" name="runtime">
        <el-form label-position="top">
          <el-form-item v-for="field in runtimeFields" :key="field.key">
            <template #label>
              <span>{{ field.key }}</span>
              <span v-if="field.required" class="ops-field-req">必填</span>
            </template>
            <el-input
              v-model="config.agentrun.runtime[field.key]"
              :type="field.secret ? 'password' : 'text'"
              :show-password="field.secret"
              :placeholder="field.placeholder || field.key"
            />
            <p class="ops-field-tip">{{ tips[field.key] }}</p>
          </el-form-item>
        </el-form>
      </el-collapse-item>
      <el-collapse-item title="部署指令" name="cmd">
        <el-form label-position="top">
          <el-form-item label="命令">
            <el-input v-model="ar.cli_command" />
            <p class="ops-field-tip">{{ tips.cli_command }}</p>
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <el-form v-else-if="config.product === 'aliyun_ecs'" label-position="top">
      <el-form-item label="地域">
        <el-input v-model="config.aliyun_ecs.region" />
        <p class="ops-field-tip">ECS 所在地域，例如 cn-hangzhou。本期演示不登录机器。</p>
      </el-form-item>
      <el-form-item label="实例 ID">
        <el-input v-model="config.aliyun_ecs.instance_id" />
        <p class="ops-field-tip">云服务器实例 ID，控制台实例列表复制。</p>
      </el-form-item>
      <el-form-item label="SSH 用户 / 端口">
        <div class="ops-field-row">
          <el-input v-model="config.aliyun_ecs.ssh_user" />
          <el-input v-model="config.aliyun_ecs.ssh_port" />
        </div>
        <p class="ops-field-tip">登录用户名与端口，默认 root / 22。</p>
      </el-form-item>
      <el-form-item label="部署目录">
        <el-input v-model="config.aliyun_ecs.deploy_path" />
        <p class="ops-field-tip">代码放到机器上的目录。</p>
      </el-form-item>
    </el-form>

    <el-form v-else-if="config.product === 'tencent_cvm'" label-position="top">
      <el-form-item label="地域">
        <el-input v-model="config.tencent_cvm.region" />
        <p class="ops-field-tip">CVM 地域，例如 ap-guangzhou。本期演示不调用腾讯云。</p>
      </el-form-item>
      <el-form-item label="实例 ID">
        <el-input v-model="config.tencent_cvm.instance_id" />
        <p class="ops-field-tip">云服务器实例 ID。</p>
      </el-form-item>
      <el-form-item label="SecretId / SecretKey">
        <div class="ops-field-row">
          <el-input v-model="config.tencent_cvm.secret_id" placeholder="SecretId" />
          <el-input v-model="config.tencent_cvm.secret_key" type="password" show-password placeholder="SecretKey" />
        </div>
        <p class="ops-field-tip">腾讯云 API 密钥，勿提交 git。</p>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { AGENTRUN_CODE_LANGUAGES, AGENTRUN_FIELD_TIPS, FALLBACK_DEPLOY_PRODUCTS } from '../../utils/deployMeta.js';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  products: { type: Array, default: () => [] },
  defaults: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:modelValue']);

const open = ref([ 'account', 'platform', 'runtime', 'cmd' ]);
const config = reactive(emptyLocal());
const tips = AGENTRUN_FIELD_TIPS;
const codeLanguageOptions = AGENTRUN_CODE_LANGUAGES;
const runtimeFields = [
  { key: 'DATABASE_URL', secret: true, required: true },
  { key: 'AGENT_DATABASE_URL', secret: true, required: false, placeholder: '空则同 DATABASE_URL' },
  { key: 'INTERNAL_API_KEY', secret: true, required: true },
  { key: 'DEEPSEEK_API_KEY', secret: true, required: true },
  { key: 'CLOUD_DATA_OPS_TOKEN', secret: true, required: false },
  { key: 'SHELL_BASE_URL', secret: false, required: false },
  { key: 'CORS_ORIGIN', secret: false, required: false },
  { key: 'LEJIAN_API_BASE_URL', secret: false, required: false },
];

function emptyLocal() {
  return {
    product: 'generic',
    agentrun: {
      target_env: 'prod',
      cli_command: 'fitness-cli prod',
      account: { account_id: '', access_key_id: '', access_key_secret: '', sd_access: 'fitness-prod' },
      platform: {
        region: 'cn-hangzhou',
        workspace_id: '',
        agent_name: 'fitness-pi-server-prod-code',
        endpoint_name: 'production',
        agent_base_url: '',
        vpc_id: '',
        vswitch_id: '',
        security_group_id: '',
        nas_server_addr: '',
        log_project: '',
        log_store: 'fitness-agent-prod',
        code_language: 'nodejs20',
      },
      runtime: {
        DATABASE_URL: '',
        AGENT_DATABASE_URL: '',
        INTERNAL_API_KEY: '',
        DEEPSEEK_API_KEY: '',
        CLOUD_DATA_OPS_TOKEN: '',
        SHELL_BASE_URL: '',
        CORS_ORIGIN: '*',
        LEJIAN_API_BASE_URL: 'https://lejian-api.bboycc.cn',
      },
    },
    aliyun_ecs: { region: 'cn-hangzhou', instance_id: '', ssh_user: 'root', ssh_port: '22', deploy_path: '/opt/app' },
    tencent_cvm: { region: 'ap-guangzhou', instance_id: '', secret_id: '', secret_key: '', deploy_path: '/opt/app' },
  };
}

function merge(target, extra) {
  if (!extra || typeof extra !== 'object') return;
  for (const [ key, value ] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      merge(target[key], value);
    } else if (value !== undefined && target[key] !== value) {
      target[key] = value;
    }
  }
}

let applying = false;

function cloneOf(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function sameConfig(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

watch(
  () => props.modelValue,
  (value) => {
    if (applying || sameConfig(value, config)) return;
    applying = true;
    merge(config, props.defaults);
    merge(config, value);
    nextTick(() => {
      applying = false;
    });
  },
  { immediate: true },
);

watch(
  config,
  () => {
    if (applying || sameConfig(props.modelValue, config)) return;
    applying = true;
    emit('update:modelValue', cloneOf(config));
    nextTick(() => {
      applying = false;
    });
  },
  { deep: true },
);

const ar = computed(() => config.agentrun);
const productOptions = computed(() => (
  props.products?.length ? props.products : FALLBACK_DEPLOY_PRODUCTS
));
const currentMeta = computed(() => {
  return productOptions.value.find((item) => item.id === config.product)
    || { description: '', status: 'live', name: config.product };
});

function productLabel(item) {
  return item.status === 'demo' ? `${item.name}（演示）` : item.name;
}
</script>

<style scoped>
.ops-deploy-hint {
  margin: 8px 0 0;
  color: var(--ops-color-text-secondary, #5c6b62);
  font-size: 13px;
}

.ops-deploy-alert {
  margin-bottom: 12px;
}

.ops-prereq {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #5c6b62;
}

.ops-field-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ops-field-tip {
  margin: 6px 0 0;
  color: var(--ops-color-text-secondary, #5c6b62);
  font-size: 12px;
  line-height: 1.5;
}

.ops-field-req {
  margin-left: 6px;
  color: var(--ops-color-danger, #f56c6c);
  font-size: 12px;
  font-weight: 400;
}
</style>
