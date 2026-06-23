import { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, Select, Space, Typography, message } from 'antd';
import { fetchLlmProfiles, streamAgentChat } from '../services/agentChat.js';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

function newSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AgentChatPage() {
  const sessionRef = useRef(newSessionId());
  const [profiles, setProfiles] = useState([]);
  const [llmProfile, setLlmProfile] = useState('');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [streaming, setStreaming] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLlmProfiles()
      .then(data => {
        setProfiles(data.profiles || []);
        setLlmProfile(data.default_profile_id || '');
      })
      .catch(() => message.warning('无法加载 LLM 配置，请确认 agent-server 已启动'));
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    setStreaming('');
    setStatus('连接中…');
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      await streamAgentChat(
        {
          session_id: sessionRef.current,
          message: text,
          llm_profile: llmProfile || undefined,
        },
        {
          onStatus: ({ label }) => setStatus(label || ''),
          onDelta: ({ reply }) => setStreaming(reply || ''),
          onMessage: payload => {
            const reply = payload.reply || payload.response || '';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
            setStreaming('');
            setStatus('');
          },
          onError: ({ message: msg }) => message.error(msg || 'Agent 错误'),
        },
      );
    } catch (e) {
      message.error(e.message || '对话失败');
    } finally {
      setLoading(false);
      setStatus('');
      setStreaming('');
    }
  };

  return (
    <Card title="AI 创作助手（Pi Agent）">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Text type="secondary">会话 ID：</Text>
          <Text code>{sessionRef.current}</Text>
          <Select
            style={{ minWidth: 220 }}
            placeholder="选择模型"
            value={llmProfile || undefined}
            onChange={setLlmProfile}
            options={profiles.map(p => ({
              value: p.id,
              label: `${p.label}${p.available ? '' : '（不可用）'}`,
              disabled: !p.available,
            }))}
          />
        </Space>

        <div
          style={{
            minHeight: 320,
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 16,
          }}
        >
          {messages.map((m, i) => (
            <Paragraph key={i}>
              <Text strong>{m.role === 'user' ? '你' : '助手'}：</Text> {m.content}
            </Paragraph>
          ))}
          {streaming && (
            <Paragraph type="secondary">
              <Text strong>助手（流式）：</Text> {streaming}
            </Paragraph>
          )}
          {!messages.length && !streaming && (
            <Text type="secondary">输入创作需求，通过 agent-server SSE 与 Pi 对话。</Text>
          )}
        </div>

        {status && <Text type="secondary">{status}</Text>}

        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            rows={3}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="例如：帮我写一段都市言情开篇…"
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </Space.Compact>
        <Button type="primary" loading={loading} onClick={handleSend}>
          发送
        </Button>
      </Space>
    </Card>
  );
}
