# Docker 部署指南

## 快速开始

### 1. 准备环境变量

编辑 `.env` 文件，配置外部数据库连接：

```env
# 数据库连接配置（连接到外部数据库容器）
DB_HOST=192.168.188.4  # 你的数据库容器IP地址
DB_PORT=5432
DB_NAME=airdrop_tracker
DB_USER=username
DB_PASSWORD=password

# 应用配置
PORT=3000
NODE_ENV=production

# 登录凭证（请修改为自己的用户名和密码）
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_secure_password

# Docker 端口映射
APP_PORT=8080
```

**注意事项：**
- `DB_HOST` 应该是数据库容器的IP地址或容器名称
- `APP_PORT` 是映射到宿主机的端口，如果 3000 端口被占用，可以改为其他端口（如 8080）
- 容器内部始终使用 3000 端口，`APP_PORT` 只是外部访问端口

### 2. 初始化数据库

在启动应用前，确保数据库中已创建表结构。连接到你的数据库容器执行：

```bash
# 使用 init.sql 初始化表结构
# 假设你的数据库容器名为 postgres-container
docker cp init.sql <your-db-container-name>:/tmp/init.sql
docker exec -i <your-db-container-name> psql -U letta -d airdrop_tracker -f /tmp/init.sql

# 或者直接执行
docker exec -i <your-db-container-name> psql -U letta -d airdrop_tracker < init.sql
```

### 3. 启动应用服务

使用 Docker Compose 启动应用：

```bash
docker-compose up -d
```

这个命令会：
- 自动构建应用镜像
- 启动 Node.js 应用容器
- 连接到外部数据库

### 4. 查看服务状态

```bash
# 查看容器状态
docker-compose ps

# 查看应用日志
docker-compose logs -f app

# 实时查看最新日志
docker-compose logs -f --tail=100 app
```

### 5. 访问应用

应用启动后，在浏览器访问：

```
http://localhost:8080
```

（端口号取决于你在 `.env` 中设置的 `APP_PORT`）

### 6. 停止服务

```bash
# 停止应用容器
docker-compose stop

# 停止并删除容器
docker-compose down
```

## 常用操作

### 重新构建镜像

如果修改了代码，需要重新构建：

```bash
docker-compose build app
docker-compose up -d app
```

### 查看实时日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看应用日志
docker-compose logs -f app
```

### 进入容器内部

```bash
# 进入应用容器
docker-compose exec app sh

# 进入数据库容器
docker-compose exec db psql -U postgres -d airdrop_tracker
```

### 备份数据库

```bash
# 导出数据库
docker-compose exec db pg_dump -U postgres airdrop_tracker > backup.sql

# 导入数据库
docker-compose exec -T db psql -U postgres airdrop_tracker < backup.sql
```

### 重启服务

```bash
# 重启应用
docker-compose restart app

# 重启所有服务
docker-compose restart
```

## 生产环境部署建议

### 1. 安全配置

- 修改 `.env` 中的默认密码为强密码
- 考虑不暴露数据库端口（删除 db 服务的 ports 配置）
- 使用 HTTPS（通过 Nginx 反向代理）

### 2. 资源限制

在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 3. 数据持久化

数据库数据会自动持久化到 Docker volume `postgres-data` 中。

查看 volume：
```bash
docker volume ls
docker volume inspect mergdroprecord_postgres-data
```

### 4. 日志管理

配置日志轮转：

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. 使用 Nginx 反向代理

创建 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 故障排查

### 应用无法连接数据库

```bash
# 检查数据库是否健康
docker-compose exec db pg_isready -U postgres

# 检查网络连接
docker-compose exec app ping db
```

### 端口已被占用

修改 `.env` 中的 `APP_PORT`：

```env
APP_PORT=8080  # 使用 8080 或其他未被占用的端口
```

然后重启容器：
```bash
docker-compose down
docker-compose up -d
```

### 查看详细错误信息

```bash
# 查看容器详细信息
docker-compose logs app --tail=100

# 查看容器状态
docker inspect airdrop-tracker-app
```

## 更新应用

1. 拉取最新代码
2. 重新构建并启动：

```bash
git pull
docker-compose build app
docker-compose up -d app
```

## 完全清理

删除所有容器、镜像和数据：

```bash
docker-compose down -v
docker rmi mergdroprecord_app
```

## 健康检查

应用和数据库都配置了健康检查，Docker 会自动监控服务状态并在失败时重启。

- 应用健康检查：`/api/health` 端点
- 数据库健康检查：`pg_isready` 命令

查看健康状态：
```bash
docker-compose ps
```
