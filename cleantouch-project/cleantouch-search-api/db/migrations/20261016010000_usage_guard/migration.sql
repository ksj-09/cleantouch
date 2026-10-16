-- Server-only ledger. No images, queries, audio, raw IPs or conversations.
CREATE TABLE IF NOT EXISTS ct_usage_bucket (
 key text PRIMARY KEY, used bigint NOT NULL CHECK(used>=0), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS ct_request_nonce (
 key text PRIMARY KEY, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ct_usage_expiry ON ct_usage_bucket(expires_at);
CREATE INDEX IF NOT EXISTS ct_nonce_expiry ON ct_request_nonce(expires_at);
REVOKE ALL ON ct_usage_bucket,ct_request_nonce FROM PUBLIC;

CREATE OR REPLACE FUNCTION ct_admit_request(
 subject text, network text, nonce text, task text,
 global_limit integer, device_limit integer, network_limit integer, minute_limit integer
) RETURNS TABLE(allowed boolean, reason text, remaining integer, retry_seconds integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 t timestamptz:=clock_timestamp(); day_key text; minute_key text;
 units integer; keys text[]; caps integer[]; i integer; count_now bigint;
BEGIN
 IF subject !~ '^[a-f0-9]{64}$' OR network !~ '^[a-f0-9]{64}$' OR nonce !~ '^[a-f0-9]{64}$'
    OR least(global_limit,device_limit,network_limit,minute_limit)<1 THEN RAISE EXCEPTION 'invalid admission'; END IF;
 units:=CASE task WHEN 'product' THEN 2 WHEN 'objects' THEN 5 WHEN 'similar' THEN 8
   WHEN 'speech' THEN 2 WHEN 'live-token' THEN 25 WHEN 'chat' THEN 3 ELSE NULL END;
 IF units IS NULL THEN RAISE EXCEPTION 'invalid task'; END IF;
 day_key:=to_char(t AT TIME ZONE 'UTC','YYYYMMDD');
 minute_key:=to_char(t AT TIME ZONE 'UTC','YYYYMMDDHH24MI');
 keys:=ARRAY['global:'||day_key,'device:'||day_key||':'||subject,'network:'||day_key||':'||network,'minute:'||minute_key||':'||network];
 caps:=ARRAY[global_limit,device_limit,network_limit,minute_limit];
 -- Every admission locks the same daily row first, then updates all buckets
 -- inside this transaction. Cold starts and parallel instances cannot overspend.
 INSERT INTO ct_usage_bucket VALUES(keys[1],0,t+interval '7 days') ON CONFLICT DO NOTHING;
 PERFORM 1 FROM ct_usage_bucket WHERE key=keys[1] FOR UPDATE;
 IF EXISTS(SELECT 1 FROM ct_request_nonce WHERE key=nonce) THEN
   RETURN QUERY SELECT false,'replay',0,0; RETURN;
 END IF;
 FOR i IN 1..4 LOOP
   INSERT INTO ct_usage_bucket VALUES(keys[i],0,t+interval '7 days') ON CONFLICT DO NOTHING;
   SELECT used INTO count_now FROM ct_usage_bucket WHERE key=keys[i] FOR UPDATE;
   IF count_now+units>caps[i] THEN
     RETURN QUERY SELECT false,CASE WHEN i=1 THEN 'global' WHEN i=2 THEN 'device' WHEN i=3 THEN 'network' ELSE 'minute' END,0,
       CASE WHEN i=4 THEN greatest(1,ceil(extract(epoch FROM date_trunc('minute',t)+interval '1 minute'-t))::integer)
       ELSE greatest(1,ceil(extract(epoch FROM (date_trunc('day',t AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'-t))::integer) END;
     RETURN;
   END IF;
 END LOOP;
 INSERT INTO ct_request_nonce VALUES(nonce,t+interval '3 minutes');
 UPDATE ct_usage_bucket SET used=used+units WHERE key=ANY(keys);
 SELECT caps[2]-used INTO count_now FROM ct_usage_bucket WHERE key=keys[2];
 DELETE FROM ct_request_nonce WHERE key IN(SELECT n.key FROM ct_request_nonce n WHERE expires_at<t LIMIT 1000);
 DELETE FROM ct_usage_bucket WHERE key IN(SELECT b.key FROM ct_usage_bucket b WHERE expires_at<t LIMIT 1000);
 RETURN QUERY SELECT true,'ok',count_now::integer,0;
END $$;
-- PUBLIC means authenticated database roles, not public web requests. Runtime
-- credentials may execute the guarded transaction but cannot access raw tables.
GRANT EXECUTE ON FUNCTION ct_admit_request(text,text,text,text,integer,integer,integer,integer) TO PUBLIC;
