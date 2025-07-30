// Vercel Serverless Function for WebSocket proxy
// Note: Vercel doesn't support persistent WebSocket connections in serverless functions
// This is a placeholder for potential HTTP-based proxy implementation

export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        res.status(200).json({
            message: 'WebSocket proxy endpoint',
            note: 'Vercel不支持持久WebSocket连接，请考虑使用其他部署方案如Render、Railway或Heroku',
            alternatives: [
                'Render.com - 支持WebSocket',
                'Railway.app - 支持WebSocket', 
                'Heroku - 支持WebSocket',
                'DigitalOcean App Platform - 支持WebSocket'
            ]
        });
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}