-- 数据库初始化脚本
-- 创建扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    volume DECIMAL(15,8) DEFAULT 0,
    points_balance INTEGER DEFAULT 2,
    points_trading INTEGER DEFAULT 0,
    points_consumed INTEGER DEFAULT 0,
    loss DECIMAL(15,8) DEFAULT 0,
    income DECIMAL(15,8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入一些示例数据（可选）
INSERT INTO transactions (date, volume, points_balance, points_trading, points_consumed, loss, income) VALUES
    (CURRENT_DATE - INTERVAL '1 day', 1000.5, 2, 50, 10, 5.25, 12.75),
    (CURRENT_DATE - INTERVAL '2 days', 2000.0, 2, 100, 20, 10.50, 25.50),
    (CURRENT_DATE - INTERVAL '3 days', 1500.25, 2, 75, 15, 7.88, 18.75)
ON CONFLICT (date) DO NOTHING;
