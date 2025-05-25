const { ethers } = require("ethers");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const randomUseragent = require("random-useragent");
const crypto = require("crypto");
const readline = require("readline");
const { HttpsProxyAgent } = require("https-proxy-agent");

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}${colors.bright}[INFO]${colors.reset} ${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${colors.bright}[SUCCESS]${colors.reset} ${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${colors.bright}[WARN]${colors.reset} ${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${colors.bright}[ERROR]${colors.reset} ${colors.red}${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.magenta}${colors.bright}${msg}${colors.reset}`),
  separator: () => console.log(`${colors.dim}${'═'.repeat(80)}${colors.reset}`)
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const randomDelay = (min = 3000, max = 12000, exponentialFactor = 1) => {
  const baseDelay = Math.random() * (max - min) + min;
  const finalDelay = baseDelay * exponentialFactor;
  return new Promise(resolve => setTimeout(resolve, finalDelay));
};

const inviteCodes = [
  "lC8qvGgI5ffOtVKx",
];

const getRandomUserAgent = () => {
  return randomUseragent.getRandom((ua) => {
    return ua.browserName === 'Chrome' || ua.browserName === 'Firefox' || ua.browserName === 'Safari';
  });
};

const generateFingerprint = () => {
  const screens = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1600, height: 900 },
    { width: 2560, height: 1440 }
  ];
  
  const timezones = [
    'America/New_York', 'America/Los_Angeles', 'Europe/London', 
    'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
    'America/Chicago', 'America/Denver', 'Europe/Paris'
  ];
  
  const languages = [
    'en-US,en;q=0.9', 'en-GB,en;q=0.9', 'en-US,en;q=0.8,es;q=0.6',
    'en-US,en;q=0.9,fr;q=0.8', 'en-US,en;q=0.9,de;q=0.8'
  ];
  
  const screen = screens[Math.floor(Math.random() * screens.length)];
  
  return {
    screen,
    timezone: timezones[Math.floor(Math.random() * timezones.length)],
    language: languages[Math.floor(Math.random() * languages.length)],
    platform: ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
    cookieEnabled: true,
    doNotTrack: Math.random() > 0.5 ? '1' : null,
    sessionId: crypto.randomBytes(16).toString('hex')
  };
};

const generateHeaders = (token = null, fingerprint) => {
  const userAgent = getRandomUserAgent();
  
  const baseHeaders = {
    "User-Agent": userAgent,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": fingerprint.language,
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Origin": "https://testnet.pharosnetwork.xyz",
    "Referer": "https://testnet.pharosnetwork.xyz/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-Ch-Ua": `"Not_A Brand";v="8", "Chromium";v="${Math.floor(Math.random() * 10) + 110}"`,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": `"${fingerprint.platform}"`,
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
  
  if (fingerprint.doNotTrack) {
    baseHeaders["DNT"] = fingerprint.doNotTrack;
  }
  
  baseHeaders["X-Session-Id"] = fingerprint.sessionId;
  baseHeaders["X-Timestamp"] = Date.now().toString();
  
  if (token) {
    baseHeaders["Authorization"] = `Bearer ${token}`;
    baseHeaders["Content-Type"] = "application/json";
  }
  
  if (Math.random() > 0.5) {
    baseHeaders["X-Requested-With"] = "XMLHttpRequest";
  }
  
  if (Math.random() > 0.7) {
    baseHeaders["Upgrade-Insecure-Requests"] = "1";
  }
  
  return baseHeaders;
};

const getRandomInviteCode = () => inviteCodes[Math.floor(Math.random() * inviteCodes.length)];

const loadPrivateKeys = () => {
  try {
    const pkPath = path.join(__dirname, 'pk.txt');
    if (!fs.existsSync(pkPath)) {
      log.error('pk.txt file not found! Please create it with private keys (one per line)');
      process.exit(1);
    }
    
    const content = fs.readFileSync(pkPath, 'utf8');
    const privateKeys = content
      .split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0)
      .map(key => key.startsWith('0x') ? key : `0x${key}`);
    
    if (privateKeys.length === 0) {
      log.error('No valid private keys found in pk.txt!');
      process.exit(1);
    }
    
    return privateKeys;
  } catch (error) {
    log.error(`Failed to load private keys: ${error.message}`);
    process.exit(1);
  }
};

const loadProxies = () => {
  try {
    const proxyPath = path.join(__dirname, 'proxies.txt');
    if (!fs.existsSync(proxyPath)) {
      return [];
    }
    
    const content = fs.readFileSync(proxyPath, 'utf8');
    const proxies = content
      .split('\n')
      .map(proxy => proxy.trim())
      .filter(proxy => proxy.length > 0);
    
    return proxies;
  } catch (error) {
    log.warn(`Failed to load proxies: ${error.message}`);
    return [];
  }
};

const createProxyAgent = (proxy) => {
  try {
    let proxyUrl;
    
    if (proxy.includes('@')) {
      const [credentials, hostPort] = proxy.split('@');
      const [username, password] = credentials.split(':');
      const [host, port] = hostPort.split(':');
      proxyUrl = `http://${username}:${password}@${host}:${port}`;
    } else {
      const [host, port] = proxy.split(':');
      proxyUrl = `http://${host}:${port}`;
    }
    
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    log.warn(`Invalid proxy format: ${proxy}`);
    return null;
  }
};

const simulateHumanBehavior = async (useDelay) => {
  if (!useDelay) return;
  
  const actions = ['reading', 'moving_mouse', 'clicking', 'typing'];
  const action = actions[Math.floor(Math.random() * actions.length)];
  
  switch (action) {
    case 'reading':
      await randomDelay(1500, 4000);
      break;
    case 'moving_mouse':
      await randomDelay(200, 800);
      break;
    case 'clicking':
      await randomDelay(100, 300);
      break;
    case 'typing':
      await randomDelay(1000, 2500);
      break;
  }
};

const makeRequest = async (url, options, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        log.warn(`Retry attempt ${attempt}/${maxRetries}`);
      }
      
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 10;
        log.warn(`Rate limited. Waiting ${retryAfter}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok && response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      log.warn(`Request failed (attempt ${attempt}): ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
};

const processWallet = async (privateKey, index, total, useDelay, proxy = null) => {
  const fingerprint = generateFingerprint();
  let retryCount = 0;
  const maxRetries = 5;
  
  const processWithRetry = async () => {
    try {
      log.separator();
      log.header(`🚀 Processing Wallet ${index + 1}/${total}`);
      
      const wallet = new ethers.Wallet(privateKey);
      const address = wallet.address;
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      
      log.info(`Wallet: ${colors.bright}${shortAddress}${colors.reset}`);
      log.info(`Session ID: ${colors.dim}${fingerprint.sessionId}${colors.reset}`);
      
      if (proxy) {
        const proxyHost = proxy.includes('@') ? proxy.split('@')[1].split(':')[0] : proxy.split(':')[0];
        log.info(`Using Proxy: ${colors.dim}${proxyHost}:***${colors.reset}`);
      }

      await simulateHumanBehavior(useDelay);
      
      if (useDelay) {
        await randomDelay(2000, 8000);
      }

      const message = "pharos";
      const signature = await wallet.signMessage(message);
      log.info("Signature generated successfully");

      const inviteCode = getRandomInviteCode();
      log.info(`Using invite code: ${colors.dim}${inviteCode}${colors.reset}`);

      await simulateHumanBehavior(useDelay);

      const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${address}&signature=${signature}&invite_code=${inviteCode}`;

      log.info("Attempting login...");
      
      const loginOptions = {
        method: "POST",
        headers: generateHeaders(null, fingerprint),
      };
      
      if (proxy) {
        const agent = createProxyAgent(proxy);
        if (agent) {
          loginOptions.agent = agent;
        }
      }
      
      const loginResponse = await makeRequest(loginUrl, loginOptions);
      const loginData = await loginResponse.json();

      if (loginData.code !== 0 || !loginData.data?.jwt) {
        log.error(`Login failed for ${shortAddress}: ${JSON.stringify(loginData)}`);
        return;
      }

      const token = loginData.data.jwt;
      log.success("Login successful!");

      await simulateHumanBehavior(useDelay);
      if (useDelay) {
        await randomDelay(3000, 7000);
      }

      const checkInUrl = `https://api.pharosnetwork.xyz/sign/in?address=${address}`;
      log.info("Attempting daily check-in...");

      const checkInOptions = {
        method: "POST",
        headers: generateHeaders(token, fingerprint),
      };
      
      if (proxy) {
        const agent = createProxyAgent(proxy);
        if (agent) {
          checkInOptions.agent = agent;
        }
      }

      const checkInResponse = await makeRequest(checkInUrl, checkInOptions);
      const checkInData = await checkInResponse.json();

      if (checkInData.code === 0) {
        log.success("Daily check-in completed! ✅");
      } else if (checkInData.msg && checkInData.msg.toLowerCase().includes("already signed in")) {
        console.log(`${colors.green}${colors.bright}[INFO]${colors.reset} ${colors.green}Already checked in today ⏭️${colors.reset}`);
      } else {
        log.warn(`Check-in failed: ${JSON.stringify(checkInData)}`);
      }

      await simulateHumanBehavior(useDelay);
      if (useDelay) {
        await randomDelay(1000, 3000);
      }

      const faucetStatusUrl = `https://api.pharosnetwork.xyz/faucet/status?address=${address}`;
      log.info("Checking faucet eligibility...");
      
      const faucetStatusOptions = {
        method: "GET",
        headers: generateHeaders(token, fingerprint),
      };
      
      if (proxy) {
        const agent = createProxyAgent(proxy);
        if (agent) {
          faucetStatusOptions.agent = agent;
        }
      }
      
      const faucetStatusResponse = await makeRequest(faucetStatusUrl, faucetStatusOptions);
      const statusData = await faucetStatusResponse.json();
      
      if (statusData.code === 0 && statusData.data?.is_able_to_faucet) {
        log.info("Eligible for faucet claim");

        await simulateHumanBehavior(useDelay);

        const claimUrl = `https://api.pharosnetwork.xyz/faucet/daily?address=${address}`;
        const claimOptions = {
          method: "POST",
          headers: generateHeaders(token, fingerprint),
        };
        
        if (proxy) {
          const agent = createProxyAgent(proxy);
          if (agent) {
            claimOptions.agent = agent;
          }
        }
        
        const claimResponse = await makeRequest(claimUrl, claimOptions);
        const claimData = await claimResponse.json();
        
        if (claimData.code === 0) {
          log.success("Faucet claimed successfully! 💰");
        } else if (claimData.code === 1 && claimData.msg && claimData.msg.includes("user has not bound X account")) {
          log.error("You must connect your X account in Pharos testnet dashboard to claim faucet");
        } else {
          log.error(`Faucet claim failed: ${JSON.stringify(claimData)}`);
        }
      } else {
        log.info("Faucet not available. Try again later");
      }

      await simulateHumanBehavior(useDelay);
      if (useDelay) {
        await randomDelay(1000, 3000);
      }

      const balanceUrl = `https://api.socialscan.io/pharos-testnet/v1/explorer/address/${address}/profile`;
      log.info("Fetching faucet balance...");
      
      const balanceOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://pharos-testnet.socialscan.io",
          "Referer": "https://pharos-testnet.socialscan.io/",
          "User-Agent": getRandomUserAgent()
        },
      };
      
      if (proxy) {
        const agent = createProxyAgent(proxy);
        if (agent) {
          balanceOptions.agent = agent;
        }
      }
      
      const balanceResponse = await makeRequest(balanceUrl, balanceOptions);
      const balanceData = await balanceResponse.json();
      
      if (balanceData?.balance) {
        log.success(`Faucet Balance: ${colors.bright}${colors.yellow}${balanceData.balance} $PHRS${colors.reset} 💎`);
      } else {
        log.warn("Could not fetch faucet balance");
      }

      await simulateHumanBehavior(useDelay);
      if (useDelay) {
        await randomDelay(2000, 5000);
      }

      const profileUrl = `https://api.pharosnetwork.xyz/user/profile?address=${address}`;
      log.info("Fetching profile data...");

      const profileOptions = {
        method: "GET",
        headers: generateHeaders(token, fingerprint),
      };
      
      if (proxy) {
        const agent = createProxyAgent(proxy);
        if (agent) {
          profileOptions.agent = agent;
        }
      }

      const profileResponse = await makeRequest(profileUrl, profileOptions);
      const profileData = await profileResponse.json();

      if (profileData.code !== 0 || !profileData.data?.user_info) {
        log.warn(`Could not fetch profile data: ${JSON.stringify(profileData)}`);
        return;
      }

      const totalPoints = profileData.data.user_info.TotalPoints;
      log.success(`Total Points: ${colors.bright}${colors.yellow}${totalPoints}${colors.reset} 🏆`);

      await simulateHumanBehavior(useDelay);

    } catch (error) {
      log.error(`Exception in wallet ${index + 1}: ${error.message}`);
      
      if (retryCount < maxRetries && (error.message.includes('ECONNRESET') || error.message.includes('timeout') || error.message.includes('fetch'))) {
        retryCount++;
        log.warn(`Retrying wallet ${index + 1} (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
        return processWithRetry();
      }
      throw error;
    }
  };

  return processWithRetry();
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const main = async () => {
  console.clear();
  
  log.header(`
  ██████╗ ██╗  ██╗ █████╗ ██████╗  ██████╗ ███████╗    ██████╗  ██████╗ ████████╗
  ██╔══██╗██║  ██║██╔══██╗██╔══██╗██╔═══██╗██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝
  ██████╔╝███████║███████║██████╔╝██║   ██║███████╗    ██████╔╝██║   ██║   ██║   
  ██╔═══╝ ██╔══██║██╔══██║██╔══██╗██║   ██║╚════██║    ██╔══██╗██║   ██║   ██║   
  ██║     ██║  ██║██║  ██║██║  ██║╚██████╔╝███████║    ██████╔╝╚██████╔╝   ██║   
  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝    ╚═════╝  ╚═════╝    ╚═╝   
  `);
  
  log.info(`${colors.bright}Enhanced Multi-Wallet Automation Bot v4.0${colors.reset}`);
  log.info(`${colors.bright}Features: Check-in & Faucet Claim with Proxy Support${colors.reset}`);
  log.info(`${colors.bright}By: Zun [@Zun2025]${colors.reset}`);
  log.separator();

  const useDelayAnswer = await askQuestion(`${colors.cyan}Do you want to use delays between operations? (y/n): ${colors.reset}`);
  const useDelay = useDelayAnswer.toLowerCase().startsWith('y');
  
  const randomOrderAnswer = await askQuestion(`${colors.cyan}Do you want to process wallets in random order? (y/n): ${colors.reset}`);
  const useRandomOrder = randomOrderAnswer.toLowerCase().startsWith('y');
  
  rl.close();

  const privateKeys = loadPrivateKeys();
  const proxies = loadProxies();
  
  log.info(`Loaded ${privateKeys.length} private keys from pk.txt`);
  
  if (proxies.length > 0) {
    log.info(`Loaded ${proxies.length} proxies from proxies.txt`);
    log.info(`${colors.dim}Proxy format: host:port or username:password@host:port${colors.reset}`);
    
    if (proxies.length === privateKeys.length) {
      log.success("Using 1:1 proxy-to-wallet mapping");
    } else {
      log.warn("Proxy count doesn't match wallet count - using random proxy assignment");
    }
  } else {
    log.info("No proxies.txt found - running without proxy support");
  }
  
  let keysToProcess;
  if (useRandomOrder) {
    keysToProcess = shuffleArray(privateKeys.map((key, index) => ({ key, originalIndex: index })));
    log.info(`${colors.bright}Randomized processing order${colors.reset}`);
  } else {
    keysToProcess = privateKeys.map((key, index) => ({ key, originalIndex: index }));
    log.info(`${colors.bright}Processing wallets in sequential order${colors.reset}`);
  }
  
  log.info(`${colors.bright}Delays: ${useDelay ? 'Enabled' : 'Disabled'}${colors.reset}`);
  log.separator();

  if (useDelay) {
    const startupDelay = Math.random() * 10000 + 5000;
    log.info(`${colors.dim}Initial startup delay: ${Math.round(startupDelay/1000)}s${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, startupDelay));
  }

  for (let i = 0; i < keysToProcess.length; i++) {
    const { key, originalIndex } = keysToProcess[i];
    let proxy = null;
    
    if (proxies.length > 0) {
      if (proxies.length === privateKeys.length) {
        proxy = proxies[originalIndex];
      } else {
        proxy = proxies[Math.floor(Math.random() * proxies.length)];
      }
    }
    
    await processWallet(key, originalIndex, privateKeys.length, useDelay, proxy);
    
    if (i < keysToProcess.length - 1) {
      if (useDelay) {
        const baseDelay = Math.random() * (15000 - 8000) + 8000;
        const jitter = Math.random() * 5000;
        const finalDelay = baseDelay + jitter;
        
        log.info(`${colors.dim}Waiting ${Math.round(finalDelay/1000)}s before next wallet...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  log.separator();
  log.success(`${colors.bright}🎉 All wallets processed successfully!${colors.reset}`);
  log.info(`${colors.dim}Script completed at ${new Date().toLocaleString()}${colors.reset}`);
  log.info(`${colors.dim}Total execution time: ${Math.round(process.uptime())}s${colors.reset}`);
  log.separator();
};

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  log.warn('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.warn('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
