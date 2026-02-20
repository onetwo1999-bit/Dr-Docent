-- drug_master: RLS가 켜져 있을 때 모든 유저(anon, authenticated)가 읽을 수 있도록 정책
-- 서버(service_role)는 RLS를 우회하므로 정책 불필요. 앱/클라이언트에서 anon 키로 조회 시 필요.

DROP POLICY IF EXISTS "drug_master_select_all" ON drug_master;
CREATE POLICY "drug_master_select_all"
  ON drug_master
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "drug_master_select_all" ON drug_master IS '의약품 검색용: 모든 유저가 product_name 등 조회 가능';
