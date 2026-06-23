import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Select, Space, message } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { fetchNovel, updateNovel } from '../services/novelService.js';

export default function NovelDetailPage() {
  const { id } = useParams();
  const [novel, setNovel] = useState(null);
  const [form] = Form.useForm();

  const loadNovel = async () => {
    try {
      const data = await fetchNovel(id);
      setNovel(data);
      form.setFieldsValue(data);
    } catch (e) {
      message.error(e.message || '加载失败');
    }
  };

  useEffect(() => {
    loadNovel();
  }, [id]);

  const handleSave = async values => {
    try {
      await updateNovel(id, values);
      message.success('保存成功');
      loadNovel();
    } catch (e) {
      message.error(e.message || '保存失败');
    }
  };

  if (!novel) return null;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="小说详情">
        <Descriptions column={1}>
          <Descriptions.Item label="ID">{novel.id}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{novel.created_at}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{novel.updated_at}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="编辑">
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="author_name" label="作者">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'published', label: '已发布' },
                { value: 'archived', label: '归档' },
              ]}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
            <Link to="..">返回列表</Link>
          </Space>
        </Form>
      </Card>
    </Space>
  );
}
