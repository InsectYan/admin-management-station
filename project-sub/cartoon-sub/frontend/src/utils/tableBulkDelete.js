import { ElMessage, ElMessageBox } from 'element-plus';

export async function confirmBulkDelete({ selectedCount = 0, totalCount = 0 } = {}) {
  if (!totalCount) {
    ElMessage.info('没有可删除的数据');
    return false;
  }
  const message = selectedCount
    ? `删除已勾选的 ${selectedCount} 条数据？`
    : '当前没有勾选项。点击删除会删除所有数据，请确认。';
  try {
    await ElMessageBox.confirm(message, selectedCount ? '删除勾选' : '删除全部', {
      type: 'warning',
      confirmButtonText: selectedCount ? '删除' : '确认删除',
      cancelButtonText: '取消',
    });
    return true;
  } catch {
    return false;
  }
}
