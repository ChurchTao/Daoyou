-- 创建新的简化临时角色表
CREATE TABLE IF NOT EXISTS wanjiedaoyou_temp_cultivators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    cultivator_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- 删除旧的临时表（如果存在）
DROP TABLE IF EXISTS wanjiedaoyou_temp_pre_heaven_fates;
DROP TABLE IF EXISTS wanjiedaoyou_temp_equipment;
DROP TABLE IF EXISTS wanjiedaoyou_temp_skills;
DROP TABLE IF EXISTS wanjiedaoyou_temp_battle_profiles;

-- 更新迁移日志
INSERT INTO drizzle.__drizzle_migrations (version, created_at) VALUES ('0003_simplified_temp_cultivators', NOW());
