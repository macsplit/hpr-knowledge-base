# Deployment Guide

This guide provides step-by-step instructions for deploying the HPR Knowledge Base MCP Server to various hosting platforms.

## Prerequisites

- Git installed locally
- Account on your chosen hosting platform
- Node.js 18+ installed locally for testing

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Test locally:
```bash
npm run start:http
```

3. Verify the server is running:
```bash
curl http://localhost:3000/health
```

## Deployment Options

### Option 1: Render.com (Recommended)

**Cost**: Free tier available, $7/mo for always-on service

**Steps**:

1. Create a Render account at https://render.com

2. Push your code to GitHub/GitLab/Bitbucket

3. In Render Dashboard:
   - Click "New +" → "Web Service"
   - Connect your repository
   - Configure:
     - **Name**: `hpr-knowledge-base`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm run start:http`
     - **Instance Type**: Free or Starter ($7/mo)

4. Add environment variable (optional):
   - `PORT` is automatically set by Render

5. Click "Create Web Service"

6. **Wait for deployment to complete** (see timing notes below)

7. Your server will be available at: `https://hpr-knowledge-base.onrender.com`

**⏱️ Deployment Timing (IMPORTANT)**:

First deployment takes **2-5 minutes** total:
1. **Build phase** (~30s): `npm install` runs
2. **Deploy phase** (~30-60s): Container starts
3. **Data loading phase** (~30-90s): Server loads 4,511 episodes + 4,481 transcripts
4. **Server ready**: Health endpoint responds

**What to expect in logs**:
```
Loading HPR knowledge base data...
Data loaded successfully!
HPR Knowledge Base MCP Server running on http://localhost:3000
SSE endpoint: http://localhost:3000/sse
Health check: http://localhost:3000/health
```

**Important notes**:
- **Wait for "Server running" message** in logs before testing
- Free tier uses slower hardware (2-5 min startup)
- Paid tier ($7/mo) starts faster (1-3 min)
- Free tier spins down after 15 min inactivity (30-60s wake time on first request)
- Data stays in memory once loaded (subsequent requests are fast)

**How to verify it's ready**:
- Dashboard shows green "Live" indicator
- Logs show "Server running" message
- Health endpoint responds: `curl https://hpr-knowledge-base.onrender.com/health`

**Health Check Configuration**:
- Path: `/health`
- Success Codes: 200
- **Grace Period**: Set to 180 seconds (3 minutes) to allow data loading

**Auto-scaling**: Available on paid plans

---

### Option 2: Railway.app

**Cost**: $5 free credit/month, then pay-per-usage (~$5-10/mo for small services)

**Steps**:

1. Create a Railway account at https://railway.app

2. Install Railway CLI (optional):
```bash
npm install -g @railway/cli
railway login
```

3. Deploy via CLI:
```bash
railway init
railway up
```

4. Or deploy via Dashboard:
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and runs `npm install`

5. Add start command in Railway:
   - Go to project settings
   - Add custom start command: `npm run start:http`

6. Your service URL will be generated automatically

**Advantages**:
- Pay only for what you use
- Scales to zero when idle
- Simple deployment process

---

### Option 3: Fly.io

**Cost**: Free tier (256MB RAM), ~$3-5/mo beyond that

**Steps**:

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```bash
fly auth login
```

3. Create `fly.toml` in project root:
```toml
app = "hpr-knowledge-base"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

4. Create `Procfile`:
```
web: npm run start:http
```

5. Deploy:
```bash
fly launch --no-deploy
fly deploy
```

6. Your app will be at: `https://hpr-knowledge-base.fly.dev`

**Advantages**:
- Global edge deployment
- Auto-scaling
- Good free tier

---

### Option 4: Vercel (Serverless)

**Cost**: Free tier generous (100GB bandwidth), Pro at $20/mo

**Note**: Serverless functions have cold starts and are less ideal for MCP's persistent connection model, but can work.

**Steps**:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server-http.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server-http.js"
    }
  ]
}
```

3. Deploy:
```bash
vercel
```

4. Your app will be at: `https://hpr-knowledge-base.vercel.app`

**Limitations**:
- 10 second timeout on hobby plan
- Cold starts may affect first request
- Less suitable for SSE persistent connections

---

### Option 5: Self-Hosted VPS

**Cost**: $4-6/mo (DigitalOcean, Hetzner, Linode)

**Steps**:

1. Create a VPS with Ubuntu 22.04

2. SSH into your server:
```bash
ssh root@your-server-ip
```

3. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

4. Clone your repository:
```bash
git clone https://github.com/yourusername/hpr-knowledge-base.git
cd hpr-knowledge-base
npm install
```

5. Install PM2 for process management:
```bash
npm install -g pm2
```

6. Start the server:
```bash
pm2 start server-http.js --name hpr-mcp
pm2 save
pm2 startup
```

7. Set up nginx reverse proxy:
```bash
apt-get install nginx
```

Create `/etc/nginx/sites-available/hpr-mcp`:
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

Enable site:
```bash
ln -s /etc/nginx/sites-available/hpr-mcp /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

8. (Optional) Add SSL with Let's Encrypt:
```bash
apt-get install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- All other configuration is in `server-http.js`

### Adjusting Limits

Edit these constants in `server-http.js`:

```javascript
const MAX_CONCURRENT_REQUESTS = 10;          // Max concurrent connections
const REQUEST_TIMEOUT_MS = 30000;            // Request timeout (30s)
const RATE_LIMIT_MAX_REQUESTS = 50;          // Requests per minute per IP
const MEMORY_THRESHOLD_MB = 450;             // Memory limit before rejection
const CIRCUIT_BREAKER_THRESHOLD = 5;         // Failures before circuit opens
```

## Monitoring

### Health Checks

All platforms should use the `/health` endpoint:
```bash
curl https://your-server.com/health
```

### Logs

**Render/Railway/Fly**: Check platform dashboard for logs

**Self-hosted**: Use PM2:
```bash
pm2 logs hpr-mcp
```

### Metrics to Monitor

- Response time
- Error rate
- Memory usage
- Active connections
- Rate limit hits

## Troubleshooting

### Deployment Taking Too Long

**Symptom**: Server shows "Deploying..." for several minutes, or health endpoint doesn't respond

**Causes and Solutions**:

1. **Data loading in progress** (Most common):
   - Server loads 4,511 episodes + 4,481 transcripts on startup
   - This takes 30-90 seconds on free tier, 15-30 seconds on paid tier
   - **Solution**: Wait 2-5 minutes total, check logs for "Server running" message

2. **Render health check failing too early**:
   - Default health check timeout may be too short
   - **Solution**: In Render dashboard, set health check grace period to 180 seconds

3. **Build completed but server not starting**:
   - Check start command is exactly: `npm run start:http`
   - Check logs for errors during data loading
   - Verify all data files are in repository

4. **Free tier spin-down**:
   - After 15 min inactivity, service sleeps
   - First request takes 30-60 seconds to wake
   - **Solution**: Upgrade to $7/mo always-on, or accept wake-up delay

**How to check progress**:
```bash
# Watch the logs in Render dashboard
# Look for these messages in order:
# 1. "Loading HPR knowledge base data..."
# 2. "Data loaded successfully!"
# 3. "HPR Knowledge Base MCP Server running on..."
```

### High Memory Usage

The server loads ~35MB of data on startup. If memory usage exceeds 450MB:
- Increase server RAM
- Reduce `MAX_CONCURRENT_REQUESTS`
- Check for memory leaks

### Circuit Breaker Opening

If the circuit breaker opens frequently:
- Check error logs
- Verify data files are not corrupted
- Increase `CIRCUIT_BREAKER_THRESHOLD`

### Rate Limiting Issues

If legitimate users hit rate limits:
- Increase `RATE_LIMIT_MAX_REQUESTS`
- Implement authentication for higher limits
- Consider using API keys

### Connection Timeouts

If requests timeout:
- Increase `REQUEST_TIMEOUT_MS`
- Check server performance
- Verify network connectivity

## Security Considerations

1. **CORS**: Currently allows all origins. Restrict in production:
```javascript
app.use(cors({
  origin: 'https://your-allowed-domain.com'
}));
```

2. **Rate Limiting**: Adjust based on expected traffic

3. **HTTPS**: Always use HTTPS in production

4. **Environment Variables**: Use platform secrets for sensitive config

## Updating the Server

### Platform Deployments

Most platforms auto-deploy on git push. Otherwise:

**Render**: Push to git, auto-deploys

**Railway**: `railway up` or push to git

**Fly**: `fly deploy`

**Vercel**: `vercel --prod`

### Self-Hosted

```bash
cd hpr-knowledge-base
git pull
npm install
pm2 restart hpr-mcp
```

## Cost Estimates

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| Render | Yes (sleeps) | $7/mo | Always-on, simple |
| Railway | $5 credit | ~$5-10/mo | Pay-per-use |
| Fly.io | 256MB RAM | ~$3-5/mo | Global deployment |
| Vercel | 100GB bandwidth | $20/mo | High traffic |
| VPS | No | $4-6/mo | Full control |

## Support

For deployment issues:
- Check platform documentation
- Review server logs
- Test locally first
- Open an issue on GitHub

## Next Steps

After deployment:
1. Test the `/health` endpoint
2. Try the `/sse` endpoint with an MCP client
3. Monitor logs for errors
4. Set up alerts for downtime
5. Document your deployment URL
