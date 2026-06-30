<template>
  <div class="project-overview">
    <el-row :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>项目信息</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="项目编码">{{ project.project_code }}</el-descriptions-item>
            <el-descriptions-item label="项目名称">{{ project.project_name }}</el-descriptions-item>
            <el-descriptions-item label="团队">{{ project.team || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="project.status === 'active' ? 'success' : 'info'" size="small">
                {{ { active: '活跃', draft: '草稿', archived: '归档' }[project.status] || project.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ project.description || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>关联代码仓库</template>
          <el-empty v-if="!(project.repo_urls || []).length" description="未配置仓库" />
          <ul v-else class="link-list">
            <li v-for="url in project.repo_urls" :key="url">
              <a :href="url" target="_blank" rel="noopener">{{ url }}</a>
            </li>
          </ul>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>CI/CD</template>
          <p>提供商：{{ project.cicd_config?.provider || '-' }}</p>
          <p>流水线：{{ project.cicd_config?.pipeline || '-' }}</p>
        </el-card>
        <el-card shadow="never" style="margin-top: 16px">
          <template #header>成员权限</template>
          <el-table :data="project.member_roles || []" size="small">
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="role" label="角色">
              <template #default="{ row }">
                {{ { owner: '所有者', editor: '编辑者', viewer: '查看者' }[row.role] || row.role }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
        <el-card shadow="never" style="margin-top: 16px">
          <template #header>快捷导航</template>
          <div class="quick-nav">
            <el-button type="primary" plain block @click="goItems">测试项库</el-button>
            <el-button plain block style="margin-top: 8px; margin-left: 0" @click="router.push('/fitness/plans')">测试计划</el-button>
            <el-button plain block style="margin-top: 8px; margin-left: 0" @click="router.push('/scope')">生成测试用例</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  project: { type: Object, required: true },
});

const router = useRouter();

function goItems() {
  router.push({
    path: '/testgen/items',
    query: { project_code: props.project.project_code },
  });
}
</script>

<style scoped>
.link-list {
  margin: 0;
  padding-left: 20px;
}
.link-list a {
  color: #409eff;
}
.quick-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
