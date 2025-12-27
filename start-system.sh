#!/bin/bash

echo "======================================"
echo "  ITSM-Sec Nexus System Launcher"
echo "======================================"
echo ""

# Get system IP address
SYSTEM_IP=$(hostname -I | awk '{print $1}')
echo "🌐 System IP Address: $SYSTEM_IP"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Update .env with current IP
if [ -f ".env" ]; then
    sed -i "s/SYSTEM_IP=.*/SYSTEM_IP=$SYSTEM_IP/" .env
    echo "✅ Updated .env with current IP address"
fi

# Start backend server
echo ""
echo "🚀 Starting backend API server (port 5000)..."
node backend/server.js > /tmp/itsm_backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:5000/api/v1/health > /dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "❌ Backend API failed to start"
    echo "   Check logs: tail -f /tmp/itsm_backend.log"
    exit 1
fi

# Start frontend HTTP server on all interfaces
echo ""
echo "🌐 Starting frontend HTTP server (port 5050)..."
cd /mnt/LinuxHDD/ITSM-System
python3 -m http.server 5050 --bind 0.0.0.0 > /tmp/itsm_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

sleep 2

echo ""
echo "======================================"
echo "  🎉 System Started Successfully!"
echo "======================================"
echo ""
echo "📍 Access URLs:"
echo ""
echo "   🌐 Network Access (from other devices):"
echo "      http://$SYSTEM_IP:5050/index.html"
echo ""
echo "   💻 Local Access:"
echo "      http://localhost:5050/index.html"
echo ""
echo "🔑 Default Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 API Endpoints:"
echo "   http://$SYSTEM_IP:5000/api/v1"
echo "   http://localhost:5000/api/v1"
echo ""
echo "📝 Server Logs:"
echo "   Backend:  tail -f /tmp/itsm_backend.log"
echo "   Frontend: tail -f /tmp/itsm_frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "   Or use: pkill -f 'node backend/server.js'"
echo "           pkill -f 'python3 -m http.server'"
echo ""
echo "======================================"
