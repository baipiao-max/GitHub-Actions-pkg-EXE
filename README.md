把你的 socks5-ws-client.js 上传到 GitHub 仓库

添加一个 workflow（自动构建脚本）

推送 tag → 自动输出 EXE

🟦 第 1 步：创建 GitHub 仓库

进入 GitHub → New Repository
例如：

socks5-ws-proxy


把你的文件上传：

socks5-ws-client.js
package.json   ← 可选，但最好有


你可以使用下面最简单的 package.json：

{
  "name": "socks5-ws-client",
  "version": "1.0.0",
  "bin": "socks5-ws-client.js",
  "dependencies": {
    "ws": "^8.16.0"
  }
}

🟩 第 2 步：添加 GitHub Actions Workflow

在你的仓库里创建：

.github/workflows/build.yml


内容如下（这是为你定制的 Windows EXE 构建脚本）：

name: Build Windows EXE

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Install pkg
        run: npm install -g pkg

      - name: Build EXE
        run: pkg socks5-ws-client.js --targets node20-win-x64 --output socks5-ws.exe

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: socks5-ws.exe
          path: socks5-ws.exe

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: socks5-ws.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

🟧 第 3 步：发布一个 tag → 自动触发构建

在你的本地或 GitHub 网页端执行：

如果你使用网页端：

跳转到 Releases → Draft a new release

Tag 写：

v1.0.0


保存发布。

如果你使用 Git 命令：
git tag v1.0.0
git push origin v1.0.0

🟦 第 4 步：等待 GitHub Actions 构建完成

访问：

https://github.com/<你用户名>/<仓库名>/actions


看到：

Build Windows EXE ✔


表示成功。

🟩 第 5 步：下载 EXE

GitHub 会自动把输出的：

socks5-ws.exe


上传到：

Releases → v1.0.0


你直接点下载即可。

这是纯 Windows 可执行文件，无需 Node.js，无需安装任何环境。

🎉 完成！
