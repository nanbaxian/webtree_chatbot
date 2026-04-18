-- ================================================
-- P1 数据库补丁（在 schema.sql 之后执行）
-- ================================================

-- 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- memory_snapshots 加向量列
ALTER TABLE memory_snapshots
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- 如果你之前已经用 768 维（bge-base-en-v1.5）跑过，升级到 1024 维（bge-m3）
-- 注意：此操作会要求你先清空旧 embedding 或者重新写入。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='memory_snapshots' AND column_name='embedding'
  ) THEN
    BEGIN
      ALTER TABLE memory_snapshots
        ALTER COLUMN embedding TYPE vector(1024);
    EXCEPTION WHEN others THEN
      -- 若已有数据维度不匹配导致失败：你可以先把旧值置空再执行
      -- UPDATE memory_snapshots SET embedding = NULL;
      RAISE NOTICE 'Failed to alter embedding dimension. You may need to NULL out old embeddings first.';
    END;
  END IF;
END $$;

-- 向量索引（IVFFlat，加速余弦相似度搜索）
-- lists=100 适合 <100万 条记录；记忆量小时也可用 lists=10
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_embedding
  ON memory_snapshots
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- 向量检索函数
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1024),
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id            uuid,
  tier          text,
  summary_text  text,
  key_facts     jsonb,
  clarity_score float,
  similarity    float
)
LANGUAGE sql STABLE AS $$
  SELECT id, tier, summary_text, key_facts, clarity_score,
         1 - (embedding <=> query_embedding) AS similarity
  FROM memory_snapshots
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 初始化 active_persona_id（指向第一个人设）
INSERT INTO app_settings (key, value)
SELECT 'active_persona_id', to_jsonb(id::text)
FROM personas LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- ==============================
-- P1+: 用户订阅计划（Free / Pro）
-- ==============================

CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz DEFAULT now()
);
