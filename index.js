import express from 'express';
import fetch from 'node-fetch';
import redis from 'redis';

const app = express();
const PORT = 5000;

// Create a Redis client
const redisClient = redis.createClient({
    username: 'default',
    password: process.env.PASSWORD,
    socket: {
        host: process.env.HOSTNAME,
        port: process.env.PORT
    }
});

// Handle Redis errors
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

// Ensure Redis is connected before using it
const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis ✅');
    } catch (error) {
        console.error('Failed to connect to Redis ❌', error);
        process.exit(1); // Exit if Redis fails
    }
};

// Middleware to check cache
const cache = async (req, res, next) => {
    const { username } = req.params;
    console.log(`Checking cache for: ${username}`);
    
    try {
        const data = await redisClient.get(username);
        if (data) {
            return res.json(JSON.parse(data)); // Serve from cache
        } else {
            next(); // Fetch from GitHub API
        }
    } catch (err) {
        console.error('Redis fetch error:', err);
        next(); // Continue if Redis fails
    }
};

// Fetch GitHub user repos
const fetchGitHubRepos = async (username) => {
    const response = await fetch(`https://api.github.com/users/${username}/repos`);
    if (!response.ok) throw new Error('GitHub API error');
    return await response.json();
};

// API route with Redis caching
app.get('/repos/:username', cache,  async (req, res) => {
    try {
        const { username } = req.params;
        const repos = await fetchGitHubRepos(username);

        // Store in Redis with expiry time (600 seconds)
        await redisClient.setEx(username, 600, JSON.stringify(repos));

        res.json(repos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Start server after Redis connects
connectRedis().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT} 🚀`);
    });
});
