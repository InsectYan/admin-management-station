import { useEffect, useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, message, Progress } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { deleteNovel, fetchNovels } from '../services/novelService.js';

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '归档' },
];

const statusMeta = {
  draft: { label: '草稿', className: 'novel-status-tag-draft' },
  published: { label: '已发布', className: 'novel-status-tag-published' },
  archived: { label: '归档', className: 'novel-status-tag-archived' },
};

function StatusTag({ value }) {
  const meta = statusMeta[value] || { label: value || '-', className: '' };
  return <Tag className={meta.className}>{meta.label}</Tag>;
}

export default function NovelListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [novels, setNovels] = useState([]);
  const [filters, setFilters] = useState({ title: '', status: '' });

  const loadNovels = async () => {
    setLoading(true);
    try {
      const data = await fetchNovels(filters);
      setNovels(data.list || []);
    } catch (e) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNovels();
  }, []);

  const handleDelete = async id => {
    try {
      await deleteNovel(id);
      message.success('已删除');
      loadNovels();
    } catch (e) {
      message.error(e.message || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '小说名称', dataIndex: 'title', ellipsis: true },
    { title: '作者', dataIndex: 'author_name', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag value={value} />,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 160,
      render: v => <Progress percent={v || 0} size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Link to={`${record.id}`}>查看</Link>
          <Button type="link" danger size="small" onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="小说列表"
      extra={(
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('new')}>
          新建小说
        </Button>
      )}
    >
      <div className="novel-filter-bar">
        <Input
          placeholder="输入小说名称"
          value={filters.title}
          onChange={e => setFilters(f => ({ ...f, title: e.target.value }))}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="选择状态"
          value={filters.status || undefined}
          onChange={v => setFilters(f => ({ ...f, status: v || '' }))}
          options={statusOptions.filter(o => o.value !== '')}
          style={{ width: 140 }}
          allowClear
        />
        <Button type="primary" onClick={loadNovels}>
          筛选
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={novels}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: '暂无小说，点击右上角新建' }}
      />
    </PageShell>
  );
}
