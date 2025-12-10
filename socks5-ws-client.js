const net = require("net");
const WebSocket = require("ws");

const WS_URL = "ws://217.154.212.188:9644/ws";
const WS_TOKEN = null;
const LOCAL_PORT = 1235;

let ws = null;
let wsReady = false;
let connCounter = 1;
const tcpMap = new Map();

//-------------------------------------
// WebSocket 自动重连
//-------------------------------------
function connectWS() {
    console.log("正在连接 WS:", WS_URL);

    ws = new WebSocket(WS_URL, WS_TOKEN ? { protocol: WS_TOKEN } : undefined);

    ws.on("open", () => {
        console.log("WS 已连接");
        wsReady = true;
    });

    ws.on("close", () => {
        console.log("WS 已关闭，3秒后重连");
        wsReady = false;
        setTimeout(connectWS, 3000);
    });

    ws.on("error", (e) => {
        console.log("WS 错误:", e.message);
    });

    ws.on("message", onWSMessage);
}

connectWS();

//-------------------------------------
// WS → 本地 SOCKS 客户端
//-------------------------------------
function onWSMessage(buf) {
    const str = buf.toString();

    // TCP 数据格式：DATA:123|xxxxxx
    if (str.startsWith("DATA:")) {
        const sep = str.indexOf("|");
        const connID = str.slice(5, sep);
        const data = buf.slice(sep + 1);

        const client = tcpMap.get(connID);
        if (client) client.write(data);
        return;
    }

    // TCP 关闭
    if (str.startsWith("CLOSE:")) {
        const connID = str.slice(6);
        const client = tcpMap.get(connID);
        if (client) client.end();
        tcpMap.delete(connID);
    }
}

//-------------------------------------
// SOCKS5
//-------------------------------------
function parseAddr(req) {
    const atyp = req[3];
    let host, port, offset;

    if (atyp === 1) {
        host = req.slice(4, 8).join(".");
        offset = 8;
    } else {
        const len = req[4];
        host = req.slice(5, 5 + len).toString();
        offset = 5 + len;
    }
    port = req.readUInt16BE(offset);

    return { host, port };
}

const server = net.createServer((client) => {
    console.log("新的 SOCKS5 连接");

    client.once("data", (chunk) => {
        client.write(Buffer.from([0x05, 0x00]));  // 无密码认证

        client.once("data", (req) => {
            const { host, port } = parseAddr(req);
            const connID = (connCounter++).toString();

            console.log(`TCP → ${host}:${port}    [ID=${connID}]`);

            tcpMap.set(connID, client);

            if (!wsReady) {
                console.log("WS 不可用，关闭");
                client.end();
                return;
            }

            ws.send(`TCP:${connID}|${host}:${port}|`);

            // 回复 SOCKS5 "连接成功"
            const rep = Buffer.from([
                5, 0, 0, 1,
                0,0,0,0,
                0,0
            ]);
            client.write(rep);

            client.on("data", (data) => {
                if (wsReady) {
                    ws.send(Buffer.concat([
                        Buffer.from(`DATA:${connID}|`),
                        data
                    ]));
                }
            });

            client.on("close", () => {
                ws.send(`CLOSE:${connID}`);
                tcpMap.delete(connID);
            });

            client.on("error", () => {
                ws.send(`CLOSE:${connID}`);
                tcpMap.delete(connID);
            });
        });
    });
});

server.listen(LOCAL_PORT, () => {
    console.log("SOCKS5 代理已启动: 127.0.0.1:" + LOCAL_PORT);
});

// 防止 pkg 退出
setInterval(() => {}, 1 << 30);
