import { useState } from 'react';
import { Button, Card, Form, Input, Select, Steps, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createNovel } from '../services/novelService.js';

const DRAFT_KEY = 'novel:create:draft';

function saveDraft(data) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function NovelCreationPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [draft] = useState(() => loadDraft());

  const steps = [
    { title: '基本信息' },
    { title: '大纲构建' },
    { title: '正文创作' },
    { title: '审稿润色' },
  ];

  const handleNext = async () => {
    const values = await form.validateFields();
    saveDraft({ ...loadDraft(), ...values });
    if (current < steps.length - 1) {
      setCurrent(c => c + 1);
      return;
    }
    try {
      const payload = { ...loadDraft(), ...values };
      await createNovel(payload);
      sessionStorage.removeItem(DRAFT_KEY);
      message.success('小说创建成功');
      navigate('..');
    } catch (e) {
      message.error(e.message || '创建失败');
    }
  };

  return (
    <Card title="新建小说">
      <Steps current={current} items={steps} style={{ marginBottom: 24 }} />
      <Form form={form} layout="vertical" initialValues={draft}>
        {current === 0 && (
          <>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="author_name" label="作者" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态" initialValue="draft">
              <Select
                options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'published', label: '已发布' },
                ]}
              />
            </Form.Item>
          </>
        )}
        {current === 1 && (
          <Form.Item name={['plot', 'outline']} label="大纲">
            <Input.TextArea rows={8} />
          </Form.Item>
        )}
        {current === 2 && (
          <Form.Item name={['draft', 'content']} label="正文">
            <Input.TextArea rows={12} />
          </Form.Item>
        )}
        {current === 3 && (
          <Form.Item name={['draft', 'review']} label="审稿意见">
            <Input.TextArea rows={8} />
          </Form.Item>
        )}
      </Form>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
          上一步
        </Button>
        <Button type="primary" onClick={handleNext}>
          {current === steps.length - 1 ? '完成' : '下一步'}
        </Button>
      </div>
    </Card>
  );
}
