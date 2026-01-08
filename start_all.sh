#!/bin/bash

# Simple all-in-one script
echo "Starting all blockchain services..."

# Start in background processes
cd blockchain
echo "1. Compiling contracts..."
npx hardhat compile

echo "2. Starting blockchain node..."
npx hardhat node > blockchain.log 2>&1 &
BLOCKCHAIN_PID=$!

echo "Waiting for blockchain to start..."
sleep 5

echo "3. Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

cd ../observer
echo "4. Starting observer..."
rm -f observer.db
npm start > observer.log 2>&1 &
OBSERVER_PID=$!

cd ../frontend
echo "5. Starting frontend server..."
python3 -m http.server 3000 > frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "Waiting for services to start..."
sleep 3

echo "Services ready..."

# Open browser
echo "Opening browser..."
cmd.exe /c start http://localhost:3000/ 2>/dev/null
cmd.exe /c start http://localhost:3001/ 2>/dev/null

echo "(^C to stop)"

# Keep script running and trap Ctrl+C
trap "echo ' Stopping all services...'; kill $BLOCKCHAIN_PID $OBSERVER_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait