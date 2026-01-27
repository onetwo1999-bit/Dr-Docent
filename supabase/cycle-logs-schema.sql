-- =====================================================
-- 🌸 Cycle_Logs 테이블 생성 및 업데이트 (그날 케어)
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 테이블이 이미 존재하는 경우 status 컬럼 추가
DO $$ 
BEGIN
  -- 테이블이 없으면 생성
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cycle_logs') THEN
    CREATE TABLE cycle_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ,
      cycle_length INT,
      note TEXT,
      status TEXT CHECK (status IN ('ongoing', 'completed')) DEFAULT 'ongoing',
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    
    -- 인덱스 생성
    CREATE INDEX idx_cycle_logs_user_id ON cycle_logs(user_id);
    CREATE INDEX idx_cycle_logs_start_date ON cycle_logs(start_date);
    CREATE INDEX idx_cycle_logs_status ON cycle_logs(status);
    
    -- RLS 활성화
    ALTER TABLE cycle_logs ENABLE ROW LEVEL SECURITY;
  ELSE
    -- 테이블이 이미 존재하면 status 컬럼 추가 (없는 경우만)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'cycle_logs' AND column_name = 'status'
    ) THEN
      ALTER TABLE cycle_logs 
      ADD COLUMN status TEXT CHECK (status IN ('ongoing', 'completed')) DEFAULT 'ongoing';
      
      -- 기존 데이터의 status 업데이트
      UPDATE cycle_logs 
      SET status = CASE 
        WHEN end_date IS NULL THEN 'ongoing'
        ELSE 'completed'
      END;
      
      -- 인덱스 추가
      CREATE INDEX IF NOT EXISTS idx_cycle_logs_status ON cycle_logs(status);
    END IF;
    
    -- start_date가 DATE 타입이면 TIMESTAMPTZ로 변경
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'cycle_logs' 
      AND column_name = 'start_date' 
      AND data_type = 'date'
    ) THEN
      ALTER TABLE cycle_logs 
      ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::TIMESTAMPTZ;
    END IF;
    
    -- end_date가 DATE 타입이면 TIMESTAMPTZ로 변경
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'cycle_logs' 
      AND column_name = 'end_date' 
      AND data_type = 'date'
    ) THEN
      ALTER TABLE cycle_logs 
      ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- RLS 정책 생성/업데이트
DO $$ 
BEGIN
  -- SELECT 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can view own cycle logs') THEN
    CREATE POLICY "Users can view own cycle logs" ON cycle_logs 
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  -- INSERT 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can insert own cycle logs') THEN
    CREATE POLICY "Users can insert own cycle logs" ON cycle_logs 
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- UPDATE 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can update own cycle logs') THEN
    CREATE POLICY "Users can update own cycle logs" ON cycle_logs 
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  -- DELETE 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can delete own cycle logs') THEN
    CREATE POLICY "Users can delete own cycle logs" ON cycle_logs 
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_cycle_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cycle_logs_updated_at ON cycle_logs;
CREATE TRIGGER trigger_update_cycle_logs_updated_at
  BEFORE UPDATE ON cycle_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_cycle_logs_updated_at();

-- 완료!
SELECT '✅ cycle_logs 테이블이 성공적으로 생성/업데이트되었습니다!' AS result;
