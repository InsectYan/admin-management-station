import { useEffect, useState } from 'react';
import { Button, Input, Select, Space, Table, message, Progress } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { deleteNovel, fetchNovels } from '../services/novelService.js';

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '归档' },
];

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
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '小说名称', dataIndex: 'title' },
    { title: '作者', dataIndex: 'author_name', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 160,
      render: v => <Progress percent={v || 0} size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Link to={`${record.id}`}>查看</Link>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="输入小说名称"
          value={filters.title}
          onChange={e => setFilters(f => ({ ...f, title: e.target.value }))}
          style={{ width: 200 }}
        />
        <Select
          placeholder="选择状态"
          value={filters.status}
          onChange={v => setFilters(f => ({ ...f, status: v }))}
          options={statusOptions}
          style={{ width: 140 }}
          allowClear
        />
        <Button type="primary" onClick={loadNovels}>
          筛选
        </Button>
        <Button type="dashed" onClick={() => navigate('new')}>
          新建小说
        </Button>
      </Space>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={novels} />
    </div>
  );
}
