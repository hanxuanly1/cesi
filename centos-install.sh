#!/bin/bash

# 产品加工统计管理系统 - CentOS 一键安装脚本
# 支持 CentOS 7/8/9

set -e

echo "=========================================="
echo "  产品加工统计管理系统 - CentOS 安装"
echo "=========================================="
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 root 用户或 sudo 运行此脚本"
    exit 1
fi

# 检测 CentOS 版本
if [ -f /etc/centos-release ]; then
    CENTOS_VERSION=$(rpm -q --queryformat '%{VERSION}' centos-release)
    echo "检测到 CentOS $CENTOS_VERSION"
else
    echo "错误: 此脚本仅支持 CentOS 系统"
    exit 1
fi

# 选择安装方式
echo ""
echo "请选择安装方式:"
echo "1) Docker 部署（推荐）"
echo "2) 直接安装"
read -p "请输入选项 [1-2]: " INSTALL_METHOD

case $INSTALL_METHOD in
    1)
        echo ""
        echo "=========================================="
        echo "  开始 Docker 部署"
        echo "=========================================="
        
        # 安装 Docker
        echo ""
        echo "步骤 1/6: 安装 Docker..."
        if ! command -v docker &> /dev/null; then
            if [ "$CENTOS_VERSION" == "7" ]; then
                yum install -y yum-utils device-mapper-persistent-data lvm2
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y docker-ce docker-ce-cli containerd.io
            else
                dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
                dnf install -y docker-ce docker-ce-cli containerd.io
            fi
            systemctl start docker
            systemctl enable docker
            echo "✓ Docker 安装完成"
        else
            echo "✓ Docker 已安装"
        fi
        
        # 安装 Docker Compose
        echo ""
        echo "步骤 2/6: 安装 Docker Compose..."
        if ! command -v docker-compose &> /dev/null; then
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            echo "✓ Docker Compose 安装完成"
        else
            echo "✓ Docker Compose 已安装"
        fi
        
        # 创建项目目录
        echo ""
        echo "步骤 3/6: 创建项目目录..."
        PROJECT_DIR="/opt/product-management"
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        echo "✓ 项目目录: $PROJECT_DIR"
        
        # 提示上传项目文件
        echo ""
        echo "步骤 4/6: 上传项目文件"
        echo "请将项目文件上传到: $PROJECT_DIR"
        echo "可以使用以下方式:"
        echo "  1. SCP: scp -r . root@$(hostname -I | awk '{print $1}'):$PROJECT_DIR"
        echo "  2. Git: cd $PROJECT_DIR && git clone <项目地址> ."
        echo ""
        read -p "文件已上传完成？(y/n): " UPLOADED
        
        if [ "$UPLOADED" != "y" ]; then
            echo "请上传文件后重新运行脚本"
            exit 1
        fi
        
        # 检查必要文件
        if [ ! -f "Dockerfile" ]; then
            echo "错误: 未找到 Dockerfile，请确认项目文件已正确上传"
            exit 1
        fi
        
        # 创建数据目录
        echo ""
        echo "步骤 5/6: 创建数据目录..."
        mkdir -p data
        chmod 777 data
        echo "✓ 数据目录创建完成"
        
        # 构建并启动
        echo ""
        echo "步骤 6/6: 构建并启动应用..."
        docker-compose build
        docker-compose up -d
        
        # 配置防火墙
        echo ""
        echo "配置防火墙..."
        if systemctl is-active --quiet firewalld; then
            firewall-cmd --permanent --add-port=3000/tcp
            firewall-cmd --reload
            echo "✓ 防火墙配置完成"
        else
            echo "! 防火墙未运行，跳过配置"
        fi
        
        # 等待服务启动
        echo ""
        echo "等待服务启动..."
        sleep 10
        
        # 检查状态
        if docker ps | grep -q product-management-system; then
            echo ""
            echo "=========================================="
            echo "  ✓ 部署成功！"
            echo "=========================================="
            echo ""
            echo "访问地址: http://$(hostname -I | awk '{print $1}'):3000"
            echo ""
            echo "常用命令:"
            echo "  查看日志: docker-compose logs -f"
            echo "  重启服务: docker-compose restart"
            echo "  停止服务: docker-compose down"
            echo ""
            echo "数据目录: $PROJECT_DIR/data"
        else
            echo ""
            echo "✗ 部署失败，请查看日志:"
            docker-compose logs
        fi
        ;;
        
    2)
        echo ""
        echo "=========================================="
        echo "  开始直接安装"
        echo "=========================================="
        
        # 安装 Node.js
        echo ""
        echo "步骤 1/8: 安装 Node.js..."
        if ! command -v node &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            if [ "$CENTOS_VERSION" == "7" ]; then
                yum install -y nodejs
            else
                dnf install -y nodejs
            fi
            echo "✓ Node.js 安装完成"
        else
            echo "✓ Node.js 已安装"
        fi
        
        # 创建项目目录
        echo ""
        echo "步骤 2/8: 创建项目目录..."
        PROJECT_DIR="/opt/product-management"
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        echo "✓ 项目目录: $PROJECT_DIR"
        
        # 提示上传项目文件
        echo ""
        echo "步骤 3/8: 上传项目文件"
        echo "请将项目文件上传到: $PROJECT_DIR"
        read -p "文件已上传完成？(y/n): " UPLOADED
        
        if [ "$UPLOADED" != "y" ]; then
            echo "请上传文件后重新运行脚本"
            exit 1
        fi
        
        # 安装依赖
        echo ""
        echo "步骤 4/8: 安装后端依赖..."
        npm install
        echo "✓ 后端依赖安装完成"
        
        echo ""
        echo "步骤 5/8: 安装前端依赖..."
        cd client
        npm install
        cd ..
        echo "✓ 前端依赖安装完成"
        
        # 构建前端
        echo ""
        echo "步骤 6/8: 构建前端..."
        npm run build
        echo "✓ 前端构建完成"
        
        # 创建系统服务
        echo ""
        echo "步骤 7/8: 创建系统服务..."
        cat > /etc/systemd/system/product-management.service <<EOF
[Unit]
Description=Product Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl start product-management
        systemctl enable product-management
        echo "✓ 系统服务创建完成"
        
        # 配置防火墙
        echo ""
        echo "步骤 8/8: 配置防火墙..."
        if systemctl is-active --quiet firewalld; then
            firewall-cmd --permanent --add-port=3000/tcp
            firewall-cmd --reload
            echo "✓ 防火墙配置完成"
        else
            echo "! 防火墙未运行，跳过配置"
        fi
        
        # 等待服务启动
        echo ""
        echo "等待服务启动..."
        sleep 5
        
        # 检查状态
        if systemctl is-active --quiet product-management; then
            echo ""
            echo "=========================================="
            echo "  ✓ 安装成功！"
            echo "=========================================="
            echo ""
            echo "访问地址: http://$(hostname -I | awk '{print $1}'):3000"
            echo ""
            echo "常用命令:"
            echo "  查看日志: journalctl -u product-management -f"
            echo "  重启服务: systemctl restart product-management"
            echo "  停止服务: systemctl stop product-management"
            echo "  查看状态: systemctl status product-management"
            echo ""
            echo "数据目录: $PROJECT_DIR"
        else
            echo ""
            echo "✗ 安装失败，请查看日志:"
            journalctl -u product-management -n 50
        fi
        ;;
        
    *)
        echo "无效的选项"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "  安装完成"
echo "=========================================="
