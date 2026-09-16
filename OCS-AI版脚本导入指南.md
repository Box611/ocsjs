# OCS 网课助手（含 AI 大模型自动答题）· 脚本导入指南

> 适用于任何浏览器 / 任何脚本管理器。你只需要按「方式 A / B / C」任选一种即可。

---

## 0. 先看这个（TL;DR 三步）

1. 在那个浏览器里装好脚本管理器：**脚本猫 ScriptCat** 或 **Tampermonkey**
2. 打开管理器的**管理面板**，把 `D:\download\ocsjs-4.0\build-out\ocs.user.js` **拖进去** → 点「安装」
3. 进任意网课页面，**通用 → 全局设置** 里勾选「AI 大模型自动答题」，填接口地址 + API Key + 模型

---

## 1. 你手上的成品

| 版本 | 文件 | 大小 | 说明 |
|---|---|---|---|
| **标准版**（推荐先用这个） | `D:\download\ocsjs-4.0\build-out\ocs.user.js` | 895,813 字节 | `@connect` 白名单共 20 个域名，已内置 DeepSeek / Kimi / 通义 / OpenAI / 硅基流动 / 智谱 / 豆包 / MiniMax 等常用大模型域名 |
| 全域名通用版 | `D:\download\ocsjs-4.0\build-out\ocs.common.user.js` | 895,991 字节 | `@connect *`，用于**自建或第三方中转**的 AI 接口域名 |

- 脚本版本：**4.15.4**（官方最新为 4.15.3；`@name` / `@namespace` 与官方一致，所以管理器会把它当成**同一个脚本的更新**，你原来的设置不会丢）
- ⚠️ **两个版本只能装一个**，同时装会重复运行互相冲突
- 不确定就用**标准版**；只有当你的 AI 接口是自建域名（如 one-api / new-api / 中转站）才用通用版

### 本地安装服务（方式 A 需要）

- 地址：**http://127.0.0.1:18123/**
- 直链：**http://127.0.0.1:18123/ocs.user.js** 与 **http://127.0.0.1:18123/ocs.common.user.js**
- 自己启停的方法见 [第 9 节](#9-自己启动--停止本地服务)

---

## 2. 前提：那个浏览器里得有脚本管理器

| 浏览器 | 推荐管理器 | 安装地址 |
|---|---|---|
| Chrome / Edge / Brave / Vivaldi / Opera / 360极速 / QQ浏览器 等 Chromium 内核 | **脚本猫 ScriptCat** | https://scriptcat.org/ |
| 同上 | **Tampermonkey（油猴）** | https://www.tampermonkey.net/ |
| Firefox | **Tampermonkey**（或 Firefox 版 ScriptCat） | 同上 |
| Safari（macOS / iOS） | Userscripts / Stay | ⚠️ 见下方警告 |

> ⚠️ **Safari 不推荐**：OCS 依赖 `GM_getTab`、`GM_saveTab`、`GM_addValueChangeListener`、`GM_xmlhttpRequest`、`GM_getResourceText` 等 API，Safari 的管理器大多不支持，脚本启动时会弹「OCS网课脚本不支持当前的脚本管理器」。
>
> ⚠️ **Violentmonkey（暴力猴）等其它管理器**：可能缺少 `GM_getTab` / `GM_saveTab`，同样可能弹不支持提示。**优先用脚本猫或 Tampermonkey。**

**怎么打开管理器管理面板？** 点浏览器右上角的扩展图标 → 选「管理面板 / Dashboard」。ScriptCat 的直接地址是你之前给的那个：
`extension://liilgpjgabokdklappibcjfablkpcekh/src/options.html#/`（Chrome/Edge 里也可写成 `chrome-extension://liilgpjgabokdklappibcjfablkpcekh/src/options.html#/`）

---

## 3. 三种导入方式（任选一种）

### 方式 A · URL 安装（本机浏览器最省事）

1. 确认本地服务在运行（见第 9 节）
2. 在那个浏览器里打开 **http://127.0.0.1:18123/**
3. 点对应的安装按钮 → 管理器弹出安装界面 → 点「**安装**」

**判断有没有生效**：如果打开后**直接显示一整屏代码**，说明这个浏览器没有可用的脚本管理器（或管理器被禁用）→ 改用方式 B / C。

### 方式 B · 拖拽安装（推荐给「别的浏览器」，最通用）

1. 打开该浏览器的**脚本管理器管理面板**
2. 用资源管理器找到 `D:\download\ocsjs-4.0\build-out\ocs.user.js`
3. 把文件**直接拖进**管理面板页面
4. 弹出确认框 → 点「**安装**」

（Tampermonkey、ScriptCat、Violentmonkey 都支持拖拽）

### 方式 C · 从文件导入 / 粘贴（最保险，URL 和拖拽都不行时用）

**Tampermonkey**
- 管理面板 → **实用工具** → **从文件导入** → 选择 `ocs.user.js` → 安装
- 备用：管理面板 → 点「**+**」新建脚本 → 全选删除 → **粘贴整个文件内容** → `Ctrl + S` 保存

**脚本猫 ScriptCat**
- 管理页 → **脚本列表** → **导入脚本** / **安装脚本** → 选择文件
- 也可以：**添加脚本** → 填 URL（`http://127.0.0.1:18123/ocs.user.js`）→ 安装
- 直接把文件拖到管理页同样可以

**Violentmonkey**
- 扩展图标 → 「**+**」 → **从文件安装**（或把文件拖到扩展页面）

> 提示：文件很大（约 875 KB，因为核心代码已内联），用记事本打开粘贴时**不要**用「另存为」破坏编码，直接用全选复制即可。

---

## 4. 各浏览器速查

| 场景 | 能不能用方式 A（URL） | 建议做法 |
|---|---|---|
| 同一台电脑的另一个 Chromium 浏览器（Edge / 另一个 Chrome） | ✅ | 方式 A，或拖拽 |
| 同一台电脑的 Firefox | ✅（偶尔会被当普通文件下载） | 拖拽 / 从文件导入 |
| 另一台电脑 / 手机 | ❌（服务只在本机） | 用**文件**（拷贝 `ocs.user.js` 过去后拖拽），或把服务改成局域网可访问（第 9 节），或在另一台机器上跑一遍构建 |
| Safari | ⚠️ | 不推荐（API 不支持） |

---

## 5. 怎么确认装的是「AI 版」而不是旧版

- 管理器的脚本列表里，`OCS 网课助手` 的版本显示 **4.15.4**
- 网课页面左侧悬浮面板标题显示 **`OCS-4.15.4`**
- **通用 → 全局设置** 里能看到这 5 个新配置项：
  - `AI 大模型自动答题`（复选框）
  - `AI 接口地址`
  - `AI API Key`
  - `AI 模型`
  - `自定义提示词（可选）`

只要看到这几项，就说明 AI 版已经生效（旧版 4.15.3 没有这些）。

---

## 6. 配置并使用 AI 自动答题

1. 进入任意网课页面 → 左侧面板 → **通用 → ⚙️ 全局设置**
2. 勾选 **「AI 大模型自动答题」**
3. 填写：

| 字段 | 示例值 |
|---|---|
| AI 接口地址 | `https://api.deepseek.com/v1/chat/completions` |
| AI API Key | `sk-xxxxxxxx`（在对应平台申请的 Key） |
| AI 模型 | `deepseek-chat` |
| 自定义提示词 | 可留空 |

**其它平台的接口地址参考**
- Kimi（月之暗面）：`https://api.moonshot.cn/v1/chat/completions`，模型 `moonshot-v1-8k`
- 通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，模型 `qwen-turbo`
- OpenAI：`https://api.openai.com/v1/chat/completions`，模型 `gpt-4o-mini`
- 自建 / 中转（one-api、new-api 等）：填你自己的地址，**并请安装「全域名通用版」**，否则 `@connect` 白名单会拦掉请求

4. 进入 **作业 / 考试 / 章节测试** 页面，脚本会自动作答：
   - **题库优先**：配置了题库时先查题库，题库**查不到**才用 AI（不会覆盖题库答案）
   - 答题结果里会显示 **AI** 标签，便于区分哪些答案是 AI 给的
   - AI 答案会自动存入题库缓存，同一道题不会重复请求（省钱省时间）
   - 支持单选、多选、判断、填空（多个空用 `#` 自动分隔）

---

## 7. 常见问题排查

| 现象 | 原因 / 解决 |
|---|---|
| 打开 URL 显示一屏代码 | 该浏览器没装/没启用脚本管理器 → 先装管理器，或改用拖拽/粘贴 |
| 提示「已存在相同名称脚本」 | 与官方 OCS 同名同命名空间 → 选**覆盖/更新**（设置保留） |
| 装完没有任何反应 | 脚本只在支持的平台生效（匹配 32 个域名：超星、智慧树、职教云、职教云课堂、云班课、雨课堂、Unipus 等）；先进入真正的作业/考试页面，等 3~5 秒 |
| 弹「OCS网课脚本不支持当前的脚本管理器」 | 管理器缺 `GM_getTab`/`GM_saveTab` → 换**脚本猫**或 **Tampermonkey** |
| AI 请求一直失败/超时 | ①Key 或模型名写错 ②接口地址不是 OpenAI 兼容格式 ③自建域名被 `@connect` 拦 → 用**全域名通用版** ④把 **全局设置 → 高级设置 → 搜题最大耗时** 调大 |
| AI 答案不对 | 换更强的模型（如 `deepseek-chat` → `deepseek-reasoner`）；或在「自定义提示词」里补充要求 |
| 同时装了两个版本 | 会出现双面板、互相干扰 → 在管理器里**禁用其中一个** |
| 想更新脚本 | 重新拖拽新的 `ocs.user.js` 覆盖即可（同名会提示更新） |

---

## 8. 关于 GitHub（可选）

源码已经推送到你的仓库：**https://github.com/xmdjg/ocsjs**（分支 `4.0`，提交 `28c45e47`）

⚠️ 注意：仓库里目前**只有源码，没有构建产物**，所以**不能用 GitHub 链接直接安装**。

如果你想要一个「在别的电脑/手机上也能一键安装」的链接，有两个办法：
1. 我把构建好的 `ocs.user.js` 也推到仓库（例如 `dist/ocs.user.js`），之后用 raw 链接安装
2. 你自己把 `ocs.user.js` 上传到任意直链（网盘直链、自己的服务器、Gitee Release 等），再用管理器的「从 URL 安装」

> 注意：本机 `hosts` 把 `github.com` 指向了本机（由 SteamTools 加速器转发），所以 GitHub 链接**在这台机器上**能打开，在别的没有加速器的机器上可能打不开 —— 放在国内直链上更稳。

---

## 9. 自己启动 / 停止本地服务

打开 PowerShell，执行（**窗口要保持开着**）：

```powershell
# 仅本机浏览器可访问（推荐日常使用）
node D:\download\ocsjs-4.0\build-out\serve.js 18123

# 允许局域网 / 手机访问（URL 换成 http://10.101.0.38:18123/ocs.user.js）
node D:\download\ocsjs-4.0\build-out\serve.js 18123 0.0.0.0
```

- 停止：在该窗口按 `Ctrl + C`
- 服务关掉后 **URL 就失效**，但**已经安装好的脚本照常工作**（脚本是完全自包含的，不依赖这个服务）
- 手机访问时，Windows 首次会弹防火墙提示 → 勾选「专用网络」并允许；手机与电脑需在同一个 Wi-Fi/局域网
- 本机可用的局域网地址参考：`10.101.0.38`（以太网）、`26.151.192.116`（Radmin VPN）、`192.168.220.1` / `192.168.253.1`（VMware 虚拟网卡）

---

## 10. 附：重新构建（改源码后）

```powershell
cd D:\download\ocsjs-4.0\ocsjs-4.0

# 1) 打包（沙箱里必须直接调 esbuild.exe，不能用 vite）
node_modules\.pnpm\@esbuild+win32-x64@0.28.1\node_modules\@esbuild\win32-x64\esbuild.exe `
  packages/scripts/src/index.ts --bundle --outfile=D:\download\ocsjs-4.0\build-out\index.iife.js `
  --format=iife --global-name=OCS --platform=browser --target=es2017 --charset=utf8 `
  --alias:@ocsjs/core=D:/download/ocsjs-4.0/ocsjs-4.0/packages/core/src/index.ts

# 2) 装配成 userscript
node D:\download\ocsjs-4.0\build-out\assemble.js
```

产物：`D:\download\ocsjs-4.0\build-out\ocs.user.js` 与 `ocs.common.user.js`
