import net from "node:net";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_TARGET_URL = "http://ip-api.com/json/?fields=status,message,query,country,city,isp";

function parseArgs(argv) {
  const args = {
    proxy: "",
    targetUrl: DEFAULT_TARGET_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    tcpOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") {
      args.targetUrl = argv[i + 1] || args.targetUrl;
      i += 1;
    } else if (arg === "--timeout") {
      const value = Number(argv[i + 1]);
      args.timeoutMs = Number.isFinite(value) && value > 0 ? value : args.timeoutMs;
      i += 1;
    } else if (arg === "--tcp-only") {
      args.tcpOnly = true;
    } else if (!args.proxy) {
      args.proxy = arg;
    }
  }

  return args;
}

function parseProxy(input) {
  if (!input) {
    throw new Error("Missing proxy. Use host:port or host:port:username:password.");
  }

  if (/^[a-z]+:\/\//i.test(input)) {
    const url = new URL(input);
    return {
      host: url.hostname,
      port: Number(url.port),
      username: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
    };
  }

  const [host, port, username = "", ...passwordParts] = input.split(":");
  const password = passwordParts.join(":");
  return { host, port: Number(port), username, password };
}

function validateProxy(proxy) {
  if (!proxy.host || !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) {
    throw new Error("Invalid proxy format. Expected host:port or host:port:username:password.");
  }
}

function openSocket(proxy, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const socket = net.createConnection({ host: proxy.host, port: proxy.port });

    const fail = (error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs, () => fail(new Error(`Timed out after ${timeoutMs}ms`)));
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.removeListener("error", fail);
      resolve({ socket, durationMs: Date.now() - startedAt });
    });
  });
}

async function testTcp(proxy, timeoutMs) {
  const { socket, durationMs } = await openSocket(proxy, timeoutMs);
  socket.end();
  return {
    alive: true,
    method: "tcp",
    durationMs,
    detail: "TCP connection opened successfully.",
  };
}

async function testHttpProxy(proxy, targetUrl, timeoutMs) {
  const target = new URL(targetUrl);
  if (target.protocol !== "http:") {
    throw new Error("This simple checker needs an http:// target URL. Use --url http://example.com/");
  }

  const startedAt = Date.now();
  const { socket } = await openSocket(proxy, timeoutMs);

  return new Promise((resolve, reject) => {
    let response = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };

    const headers = [
      `GET ${target.href} HTTP/1.1`,
      `Host: ${target.host}`,
      "User-Agent: profile-vault-proxy-checker/1.0",
      "Accept: application/json,text/plain,*/*",
      "Connection: close",
    ];

    if (proxy.username || proxy.password) {
      const token = Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64");
      headers.push(`Proxy-Authorization: Basic ${token}`);
    }

    socket.setTimeout(timeoutMs, () => fail(new Error(`Timed out after ${timeoutMs}ms`)));
    socket.once("error", fail);
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\r\n\r\n") && response.length < 8192) return;

      const [statusLine] = response.split("\r\n");
      const statusCode = Number(statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/)?.[1]);
      const body = response.slice(response.indexOf("\r\n\r\n") + 4).trim();

      finish({
        alive: Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 500,
        method: "http-proxy",
        durationMs: Date.now() - startedAt,
        statusCode,
        detail:
          statusCode === 407
            ? "Proxy replied but rejected authentication."
            : statusCode
              ? `Proxy returned HTTP ${statusCode}.`
              : "Proxy replied, but the response was not a normal HTTP response.",
        bodyPreview: body.slice(0, 300),
      });
    });
    socket.once("end", () => {
      if (!response) fail(new Error("Connection closed without a response."));
    });

    socket.write(`${headers.join("\r\n")}\r\n\r\n`);
  });
}

function printUsage() {
  console.log(`
Usage:
  npm run proxy:test -- <proxy> [--tcp-only] [--timeout 10000] [--url http://example.com/]

Examples:
  npm run proxy:test -- 1.2.3.4:8080
  npm run proxy:test -- 1.2.3.4:8080:username:password
  npm run proxy:test -- http://username:password@1.2.3.4:8080
  npm run proxy:test -- 1.2.3.4:1080 --tcp-only
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.proxy || args.proxy === "--help" || args.proxy === "-h") {
    printUsage();
    process.exit(args.proxy ? 0 : 1);
  }

  const proxy = parseProxy(args.proxy);
  validateProxy(proxy);

  try {
    const result = args.tcpOnly
      ? await testTcp(proxy, args.timeoutMs)
      : await testHttpProxy(proxy, args.targetUrl, args.timeoutMs);

    console.log(JSON.stringify({ proxy: `${proxy.host}:${proxy.port}`, ...result }, null, 2));
    process.exit(result.alive ? 0 : 2);
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          proxy: `${proxy.host}:${proxy.port}`,
          alive: false,
          error: error.message,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
}

main();
