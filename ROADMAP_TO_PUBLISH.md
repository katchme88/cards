# Roadmap To Publish (Play Store + App Store)

## Goal
Release the game to both stores with a repeatable process covering backend, app builds, store compliance, and post-launch operations.

## 0. Accounts, Subscriptions, And One-Time Costs

### Required Accounts
- Expo account (for EAS Build/Submit)
- Apple Developer account (App Store release)
- App Store Connect access (created from Apple Developer)
- Google Play Console account (Play Store release)
- Domain registrar account (for API and privacy policy domain)
- Cloud host account (VPS or managed platform)
- Crash analytics account (Sentry or Firebase Crashlytics)

### Typical Costs
- Apple Developer Program: 99 USD/year
- Google Play Console: 25 USD one-time
- Domain: about 10 to 20 USD/year
- VPS (starter production): about 20 to 60 USD/month
- SSL certificate: free with Let's Encrypt
- Monitoring/logging: free tier first, then usage-based
- Expo EAS Build: free tier available, paid for higher usage and priority

### Suggested Paid Services For Your Stack
- VPS: Hetzner, DigitalOcean, or Render
- Crash tracking: Sentry (free tier to start)
- Uptime checks: UptimeRobot (free tier) or Better Stack

## 1. Prepare Local Tooling

Run from mobile folder:

```bash
cd /Users/talha/laboratory/cards/mobile
npm install
npx expo --version
node -v
```

Install EAS CLI globally:

```bash
npm install -g eas-cli
eas --version
```

Login to Expo:

```bash
eas login
```

## 2. Lock Production App Identity

Update mobile/app.json with final values:
- expo.name: final public app name
- expo.slug: stable slug
- expo.version: semantic release version (example 1.0.0)
- expo.ios.bundleIdentifier: reverse-DNS id (example com.yourstudio.cards)
- expo.android.package: reverse-DNS id (example com.yourstudio.cards)

Example shape:

```json
{
	"expo": {
		"name": "Court Piece",
		"slug": "court-piece",
		"version": "1.0.0",
		"ios": {
			"bundleIdentifier": "com.yourstudio.courtpiece",
			"supportsTablet": true
		},
		"android": {
			"package": "com.yourstudio.courtpiece"
		}
	}
}
```

Important:
- Never change bundle identifier/package after launch.
- Increment version every release.

## 3. Create Environment Split (Dev/Staging/Prod)

Add environment variables for API endpoint.

For Expo public vars, use EXPO_PUBLIC_ prefix.

Example .env.production:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

Update network config to read EXPO_PUBLIC_API_BASE_URL for production builds.

## 4. Backend Production Deployment (API + Socket + DB)

### 4.1 Provision Server
- Start with 4 vCPU, 8 GB RAM, 80+ GB SSD.
- Ubuntu 22.04 LTS recommended.

### 4.2 Install Dependencies On Server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable docker
```

### 4.3 Deploy Project

```bash
git clone <your-repo-url>
cd cards
cp .env.example .env
cp db.env.example db.env
```

Fill production values in .env and db.env.

### 4.4 Run Services

```bash
docker-compose up -d --build
docker-compose ps
docker-compose logs -f api
```

### 4.5 Configure Domain + HTTPS
- Point A record for api.yourdomain.com to server IP.
- Configure Nginx reverse proxy for HTTP and WebSocket upgrade headers.
- Issue cert:

```bash
sudo certbot --nginx -d api.yourdomain.com
sudo certbot renew --dry-run
```

### 4.6 Validate Production API

```bash
curl -I https://api.yourdomain.com
```

## 5. Security And Reliability Minimums
- Re-enable production authentication (current route is dev bypass).
- Move DB writes to parameterized queries where touched.
- Restrict open ports to 22, 80, 443.
- Add daily Postgres backup cron.
- Enable restart policy for containers.
- Add uptime monitor for API health endpoint.

Backup example:

```bash
pg_dump -U <db_user> -h <db_host> <db_name> > backup_$(date +%F).sql
```

## 6. Build Setup With EAS

Initialize EAS in mobile folder:

```bash
cd /Users/talha/laboratory/cards/mobile
eas init
eas build:configure
```

Create eas.json profiles (development, preview, production).

Production build commands:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

Download artifacts from EAS links after build success.

## 7. Android Release Path (Play Store)

### 7.1 Play Console Setup
- Create app in Google Play Console.
- Complete App content section: privacy policy, ads declaration, content rating, target audience.
- Create test track (internal or closed).

### 7.2 Upload First Build
- Use Android App Bundle (.aab) from EAS.
- Add release notes.
- Start with internal testing.

Optional command using EAS submit:

```bash
eas submit --platform android --profile production
```

### 7.3 Android Testing Checklist
- Install from Play internal testing link.
- Verify login, match creation, reconnect behavior, and card image loading on mobile network.

## 8. iOS Release Path (App Store)

### 8.1 Apple Setup
- Enroll in Apple Developer Program.
- In App Store Connect, create new app with final bundle id.
- Fill App Privacy and age rating details.

### 8.2 Certificates/Signing
- Let EAS manage credentials automatically (recommended).
- If prompted, sign in to Apple account during build/submission setup.

### 8.3 Upload Build

```bash
eas submit --platform ios --profile production
```

Then in App Store Connect:
- Attach the uploaded build to a version.
- Fill metadata, screenshots, and review notes.
- Submit to TestFlight first, then App Review.

## 9. Store Listing Assets (Both Stores)

Prepare before submission:
- App icon 1024x1024
- Splash and adaptive icon assets
- Phone screenshots (minimum 3 to 8)
- Support URL
- Privacy Policy URL
- Marketing description and keywords

Suggested pages to host:
- https://yourdomain.com/privacy
- https://yourdomain.com/support

## 10. Legal And Policy Items
- Privacy policy must mention analytics, ads (if used), and account data handling.
- If adding voice chat later, update policy and permission disclosures.
- If showing ads, complete Google Play Ads declaration and Apple tracking disclosures.
- Provide data deletion contact or process.

## 11. Release Strategy

For first public rollout:
1. Internal testing (team only)
2. Closed testing (20 to 100 users)
3. Open testing (optional)
4. Production staged rollout (10 percent, then 50 percent, then 100 percent)

## 12. Post-Launch Operations Checklist
- Monitor crash-free users percentage daily.
- Monitor socket disconnect spikes and API latency.
- Track DAU, retention D1/D7, completed matches, and abandonment rate.
- Maintain release cadence: one stability update every 2 to 4 weeks.

## 13. Exact Command Runbook (Quick Copy)

Local mobile setup:

```bash
cd /Users/talha/laboratory/cards/mobile
npm install
npm run start
```

EAS setup and production builds:

```bash
cd /Users/talha/laboratory/cards/mobile
eas login
eas init
eas build:configure
eas build --platform android --profile production
eas build --platform ios --profile production
```

Submit to stores:

```bash
cd /Users/talha/laboratory/cards/mobile
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

Server deployment (example):

```bash
cd /opt
git clone <your-repo-url>
cd cards
docker-compose up -d --build
docker-compose logs -f api
```

## 14. Final Go-Live Checklist
- [ ] Production API domain live with HTTPS and WebSocket support
- [ ] Authentication restored for production
- [ ] Production environment variables configured in mobile and backend
- [ ] Android AAB built and uploaded
- [ ] iOS build uploaded to TestFlight/App Store Connect
- [ ] Privacy policy and support pages live
- [ ] Crash monitoring active
- [ ] Backups and uptime alerts active
- [ ] Internal and closed test feedback addressed
- [ ] Staged rollout plan approved
