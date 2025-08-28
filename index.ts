import { env } from "bun";
import { existsSync, mkdirSync } from "fs";
import z from "zod";
import puppeteer from "puppeteer";

const schema = z.object({
  LIBRARY_CARD: z.string().min(14).max(14),
  LIBRARY_PIN: z.string(),
  PI_MODE: z.enum(['true', 'false']).default('false'),
  CLAIM_LINK: z.string(),
  TOKEN: z.string().optional(),
  USE_ENV: z.enum(['true', 'false']).default('false')
});


const { LIBRARY_CARD, LIBRARY_PIN, PI_MODE, CLAIM_LINK, TOKEN, USE_ENV } = schema.parse(env);

// make the cfg/ directory if it doesn't exist
if (!existsSync('cfg')) {
  mkdirSync('cfg');
}

// make the cfg/token.txt file if it doesn't exist
let token = '';
if (USE_ENV === 'true') {
  token = TOKEN ?? '';
} else {
  token = await Bun.file('cfg/token.txt').text();
}
if (!token) {
  throw new Error('No token found');
}


const basicHeaders = {
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'max-age=0',
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
}

function parseCookies(cookieHeader: string): string {
  return cookieHeader.split(';').map(cookie => {
    const [key, value] = cookie.trim().split('=');
    return `${key}=${value}`;
  }).join('; ');
}

async function fetchWithRedirect(url: string, options: RequestInit = {}): Promise<{ response: Response; location: string }> {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
  });
  
  const location = response.headers.get('Location');
  if (!location) {
    throw new Error(`No redirect location found for ${url}`);
  }
  
  return { response, location };
}

// Initial login request
const { response: loginResponse, location: oclcLink } = await fetchWithRedirect(CLAIM_LINK, {
  method: 'POST',
  headers: basicHeaders,
  body: new URLSearchParams({
    user: LIBRARY_CARD,
    pass: LIBRARY_PIN,
    url: 'https://ezmyaccount.nytimes.com/corpgrouppass/redir'
  })
});

const cookieHeader = loginResponse.headers.get('Set-Cookie');
if (!cookieHeader) {
  throw new Error('No cookies found in login response');
}
console.log(cookieHeader);
const cookiesHeaders = parseCookies(cookieHeader);

// --- OCLC ---

const { location: secondRedirectLink } = await fetchWithRedirect(oclcLink, {
  headers: {
    ...basicHeaders,
    Cookie: cookiesHeaders
  }
});

const { location: thirdLink } = await fetchWithRedirect(secondRedirectLink, {
  headers: {
    ...basicHeaders,
    Cookie: cookiesHeaders
  }
});

// --- NYT ---

const { location: fourthLink } = await fetchWithRedirect(thirdLink, {
  headers: {
    ...basicHeaders,
    Cookie: cookiesHeaders
  }
});

const browser = await puppeteer.launch({
  headless: true,
  ...(PI_MODE === 'true' ? {
    executablePath: '/usr/bin/chromium-browser'
  } : {}),
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

await page.setCookie({
  name: 'NYT-S',
  value: token,
  domain: '.nytimes.com',
  path: '/',
  expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // expires in 30 days, in seconds
  httpOnly: true,
  secure: true,
  sameSite: 'None'
});

await page.goto(fourthLink);

await new Promise(resolve => setTimeout(resolve, 10000));

await page.screenshot({ path: 'screenshot.png' });

console.log('Successfully claimed');
process.exit(0);