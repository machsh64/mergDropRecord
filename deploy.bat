@echo off
REM Airdrop Tracker 部署脚本 (Windows)

echo ======================================
echo Airdrop Tracker Docker 部署
echo ======================================

REM 检查 .env 文件是否存在
if not exist .env (
    echo 错误: .env 文件不存在
    echo 请先创建 .env 文件并配置数据库连接信息
    exit /b 1
)

echo.
echo 1. 检查环境配置...
echo 数据库配置：
type .env | findstr "DB_"

echo.
echo 2. 构建 Docker 镜像...
docker-compose build

if %errorlevel% neq 0 (
    echo 错误: Docker 镜像构建失败
    exit /b 1
)

echo.
echo 3. 启动应用容器...
docker-compose up -d

if %errorlevel% neq 0 (
    echo 错误: 容器启动失败
    exit /b 1
)

echo.
echo 4. 等待应用启动...
timeout /t 5 /nobreak >nul

echo.
echo 5. 检查容器状态...
docker-compose ps

echo.
echo ======================================
echo 部署完成！
echo ======================================
echo.
echo 访问地址: http://localhost:8080
echo （端口号取决于 .env 中的 APP_PORT 配置）
echo.
echo 常用命令:
echo   查看日志: docker-compose logs -f app
echo   停止服务: docker-compose stop
echo   重启服务: docker-compose restart
echo   删除容器: docker-compose down
echo.

pause
