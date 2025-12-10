const net = require("net");
const WebSocket = require("ws");

// === 用户配置（已按你要求写好） ===
const WS_URL = "ws://217.154.212.188:9644/ws";
const WS_TOKEN = null;   // 没有 Token
const LOCAL_SOCKS_PORT = 1235;

let connCounter = 1;

// 创建 WebSocket 连接
function createWS() {
    const ws = new WebSocket(WS_URL, WS_TOKEN ? { protocol: WS_TOKEN } : undefined);

    ws.on("open", () => console.log("WS 已连接:", WS_URL));
    ws.on("close", () => console.log("WS 已关闭"));
    ws.on("error", (e) => console.error("WS 错误:", e));

    return ws;
}

let ws = createWS();

// 解析 Socks5 地址函数
function parseSocksAddress(buffer) {
    const atyp = buffer[3];

    let host, port, offset;
    if (atyp === 0x01) { // IPv4
        host = buffer.slice(4, 8).join(".");
        offset = 8;
    } else if (atyp === 0x03) { // 域名
        const len = buffer[4];
        host = buffer.slice(5, 5 + len).toString();
        offset = 5 + len;
    } else {
        throw new Error("ATYP 不支持: " + atyp);
    }

    port = buffer.readUInt16BE(offset);
    return { host, port };
}

// 本地 SOCKS5 server
const server = net.createServer((client) => {
    console.log("新的 SOCKS5 连接");

    client.once("data", (chunk) => {
        // SOCKS5 握手
        client.write(Buffer.from([0x05, 0x00]));

        client.once("data", (req) => {
            const { host, port } = parseSocksAddress(req);

            console.log(`请求连接: ${host}:${port}`);

            const connID = (connCounter++).toString();

            ws.send(`TCP:${connID}|${host}:${port}|`);

            // 返回 SOCKS5 已连接成功
            const resp = Buffer.from([
                0x05, 0x00, 0x00, 0x01,
                0, 0, 0, 0,
                0, 0
            ]);
            client.write(resp);

            // 客户端 → WS
            client.on("data", (data) => {
                const prefix = Buffer.from(`DATA:${connID}|`);
                ws.send(Buffer.concat([prefix, data]));
            });

            client.on("close", () => {
                ws.send(`CLOSE:${connID}`);
            });

            // WS → 客户端
            ws.on("message", (msg) => {
                if (typeof msg !== "string") {
                    const s = msg.toString();
                    if (s.startsWith(`DATA:${connID}|`)) {
                        client.write(msg.slice(`DATA:${connID}|`.length));
                    }
                }
            });
        });
    });
});

server.listen(LOCAL_SOCKS_PORT, () => {
    console.log(`本地 SOCKS5 已启动: 127.0.0.1:${LOCAL_SOCKS_PORT}`);
    console.log(`WS 服务器: ${WS_URL}`);
});
