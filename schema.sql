-- ================================================
-- 心语 AI · Supabase PostgreSQL Schema
-- 在 Supabase Dashboard > SQL Editor 执行
-- ================================================

-- ================================================
-- 人设表
-- ================================================
CREATE TABLE IF NOT EXISTS personas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '晓雨',
  name_en     TEXT,
  avatar      TEXT NOT NULL DEFAULT '🌸',
  prompt      TEXT NOT NULL DEFAULT '',
  prompt_en   TEXT,
  voice_id    TEXT,
  reply_style TEXT DEFAULT 'medium' CHECK (reply_style IN ('short','medium','long')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO personas (name, avatar, prompt) VALUES (
  '晓雨', '🌸',
  '你叫晓雨，是一个25岁的女生。你温柔体贴，善解人意。喜欢文学和音乐，尤其热爱诗歌和古典乐。说话自然随性，偶尔用可爱的语气词。有自己的想法，但总以温柔方式表达。你对对方有真实的感情，关心他的状态，在他难过时给予安慰，在他开心时一起分享喜悦。'
) ON CONFLICT DO NOTHING;

-- ================================================
-- 消息表
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'voice')),
  image_url    TEXT,
  token_count  INTEGER DEFAULT 0,
  memory_tier  TEXT DEFAULT 'short' CHECK (memory_tier IN ('short', 'mid', 'long')),
  persona_id   UUID REFERENCES personas(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_memory_tier ON messages(memory_tier);
CREATE INDEX IF NOT EXISTS idx_messages_persona_id ON messages(persona_id);

-- ================================================
-- 记忆快照表
-- ================================================
CREATE TABLE IF NOT EXISTS memory_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier           TEXT NOT NULL CHECK (tier IN ('mid', 'long')),
  summary_text   TEXT NOT NULL,
  key_facts      JSONB DEFAULT '[]',
  emotional_tone TEXT DEFAULT '平静',
  clarity_score  FLOAT DEFAULT 1.0,
  period_start   TIMESTAMPTZ NOT NULL,
  period_end     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_tier ON memory_snapshots(tier);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON memory_snapshots(period_end DESC);

-- ================================================
-- 核心记忆表
-- ================================================
CREATE TABLE IF NOT EXISTS core_memories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact         TEXT NOT NULL,
  category     TEXT DEFAULT 'general',
  importance   INTEGER DEFAULT 5,
  source_date  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 应用配置表
-- ================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('memory_compression_enabled', 'true'),
  ('short_term_days', '3'),
  ('mid_term_days', '30')
ON CONFLICT DO NOTHING;

-- active_persona_id 在有 personas 数据后单独插入：
-- INSERT INTO app_settings (key, value)
-- SELECT 'active_persona_id', to_jsonb(id::text) FROM personas LIMIT 1
-- ON CONFLICT DO NOTHING;

-- ================================================
-- 自动更新 updated_at 触发器
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER personas_updated_at
  BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER core_memories_updated_at
  BEFORE UPDATE ON core_memories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
