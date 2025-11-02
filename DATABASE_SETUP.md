# 数据库初始化说明

## 前提条件
- 您已经有一个运行中的 PostgreSQL 数据库
- 您有数据库的管理员权限

## 初始化步骤

### 1. 创建数据库
```sql
-- 连接到 PostgreSQL
psql -U postgres

-- 创建数据库
CREATE DATABASE airdrop_tracker;

-- 切换到新数据库
\c airdrop_tracker
```

### 2. 执行初始化脚本
```bash
# 方法一：使用 psql 命令
psql -U postgres -d airdrop_tracker -f init.sql

# 方法二：在 psql 中执行
psql -U postgres -d airdrop_tracker
\i init.sql
```

### 3. 验证初始化
```sql
-- 检查表是否创建成功
\dt

-- 查看表结构
\d transactions

-- 查看示例数据
SELECT * FROM transactions LIMIT 5;
```

## 环境变量配置

创建 `.env` 文件，配置您的数据库连接信息：

```env
# 数据库连接配置
DB_HOST=localhost          # 您的数据库主机
DB_PORT=5432              # 数据库端口
DB_NAME=airdrop_tracker   # 数据库名称
DB_USER=postgres          # 数据库用户名
DB_PASSWORD=your_password # 数据库密码

# 应用配置
PORT=3000
NODE_ENV=production
```

## 常见问题

### 1. 数据库连接失败
- 检查 PostgreSQL 服务是否正在运行
- 验证 .env 文件中的连接信息
- 确认数据库用户有足够的权限

### 2. 表创建失败
- 确保数据库用户有 CREATE TABLE 权限
- 检查 init.sql 文件是否存在且可读

### 3. 权限问题
```sql
-- 授予用户权限
GRANT ALL PRIVILEGES ON DATABASE airdrop_tracker TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

## 备份和恢复

### 备份数据库
```bash
pg_dump -U postgres -d airdrop_tracker > backup.sql
```

### 恢复数据库
```bash
psql -U postgres -d airdrop_tracker < backup.sql
```

## 完成初始化后

1. 确保您的 PostgreSQL 数据库正在运行
2. 验证数据库连接配置正确
3. 运行启动脚本：`start.bat` (Windows) 或 `start.sh` (Linux/macOS)
4. 访问 http://localhost:3000 开始使用系统
