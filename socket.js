// socket.js
const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';  // Update to your Render Flask URL in Vercel env

function setupWebSocket(httpServer) {
  // Attach WebSocket server to the HTTP server
  const wss = new WebSocket.Server({ 
    server: httpServer, 
    path: '/ws/chat'  // Client connects to ws://your-app.vercel.app/ws/chat
  });

  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected for chat');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        const userMessage = data.message || data.queryText;

        if (!userMessage) {
          ws.send(JSON.stringify({ error: 'No message provided' }));
          return;
        }

        // Proxy to Flask /webhook (your Groq endpoint)
        const response = await axios.post(`${FLASK_URL}/webhook`, {
          queryResult: {
            queryText: userMessage,
            intent: { displayName: data.intent || '' }  // Optional: Pass intent if frontend sends it
          }
        });

        const aiResponse = response.data.fulfillmentText;

        // Send AI response back via WebSocket
        ws.send(JSON.stringify({
          response: aiResponse,
          timestamp: new Date().toISOString()
        }));

      } catch (error) {
        console.error('Chat proxy error:', error.message);
        ws.send(JSON.stringify({ error: 'Failed to get AI response' }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Welcome message on connect
    ws.send(JSON.stringify({ message: 'Connected to AI Chatbot! Ask me anything.' }));
  });

  console.log('WebSocket server attached to /ws/chat');
  return wss;  // Optional: Return for further customization
}

module.exports = { setupWebSocket };
