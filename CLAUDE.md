# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Design Principles**: Keep It Simple, Stupid (KISS) and You Aren't Gonna Need It (YAGNI). This setup is for learning purposes - prioritize simplicity and clarity over advanced features.

## Project Overview

This is a Caddy web server configuration for hosting multiple static websites under different subdomains. Each subdomain serves its own static content from separate directories.

**Dual Environment Setup**:
- **Local Development**: Uses .localhost subdomains (localhost, site1.localhost, site2.localhost)
- **Production**: Uses actual domain with subdomains (domain.com, site1.domain.com, site2.domain.com)
- Configuration managed via .env files

## Architecture

- **Caddy**: Web server with automatic HTTPS
  - Serves static files from subdomain-specific directories
  - Handles SSL/TLS certificates automatically via Let's Encrypt
  - Configuration in Caddyfile format

## Common Commands

```bash
# Local Development
cp .env.local .env
docker-compose up -d

# Production
cp .env.production .env
docker-compose up -d

# View logs
docker-compose logs -f caddy

# Stop services
docker-compose down

# Restart Caddy (reload configuration)
docker-compose restart caddy

# Validate Caddyfile syntax
docker run --rm -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile caddy:latest caddy validate --config /etc/caddy/Caddyfile
```

## Directory Structure

```
.
├── .env.local      # Local development environment variables
├── .env.production # Production environment variables
├── .env            # Active environment (copy from .env.local or .env.production)
├── docker-compose.yml
├── Caddyfile
└── sites/
    ├── site1/      # Static files for site1 subdomain
    │   └── index.html
    ├── site2/      # Static files for site2 subdomain
    │   └── index.html
    └── main/       # Static files for main domain
        └── index.html
```

## Environment Configuration

**.env.local** (Local Development):
```
DOMAIN=localhost
SITE1_DOMAIN=site1.localhost
SITE2_DOMAIN=site2.localhost
```

**.env.production** (Production):
```
DOMAIN=yourdomain.com
SITE1_DOMAIN=site1.yourdomain.com
SITE2_DOMAIN=site2.yourdomain.com
```

## Configuration Files

- `Caddyfile`: Uses environment variables for domain configuration
- `docker-compose.yml`: Reads from .env file
- `sites/`: Directory containing static files for each subdomain

## Adding New Subdomains

1. Create new directory under `sites/`
2. Add static files including `index.html`
3. Add environment variable to both .env.local and .env.production
4. Update `Caddyfile` with new subdomain configuration using the environment variable
5. Restart Caddy container