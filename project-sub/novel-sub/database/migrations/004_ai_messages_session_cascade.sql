-- sequelize.sync({ alter: true }) 可能把 FK 改成无 CASCADE，删除会话会撞消息外键
ALTER TABLE novel_ai_messages
  DROP CONSTRAINT IF EXISTS novel_ai_messages_session_id_fkey;

ALTER TABLE novel_ai_messages
  ADD CONSTRAINT novel_ai_messages_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES novel_ai_sessions(id) ON DELETE CASCADE;
