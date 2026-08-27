# dsh-balance-chip

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web
client plugin that shows your DeepSeek account balance at the bottom-left of
the chat composer — immediately to the right of the permission-switch (切换权限)
button — and refreshes it live.

## Features

- **Live balance pill**: `● 余额 ¥14.07` next to the permission switch.
  - Fetches on mount, polls every 15 s while the tab is visible, refetches on
    window focus, on session switch, and whenever a submitted turn finishes —
    so the balance tracks spend near-instantly.
  - Hover shows the full breakdown (total / topped-up / granted).
  - Click opens the DeepSeek Open Platform user console (`platform.deepseek.com/usage`)
    in a new tab.
- **Balance alert (余额预警)**: Settings → General → 余额预警 sets a warning
  threshold (per-browser `localStorage`, `0` disables). When the primary
  balance drops to (or below) the threshold, the pill's border, text, and dot
  turn red and pulse softly (`prefers-reduced-motion` respected).
- **Host route**: `GET /api/dsh/balance` queries `GET {baseURL}/user/balance`
  using the same credentials as the built-in DeepSeek provider — the stored
  `DEEPSEEK_API_KEY` credential (process env → stored value), against
  `https://api.deepseek.com` (or a trusted `DEEPSEEK_BASE_URL` launch layer).

## 功能说明（中文）

在对话框输入框的左下角（「切换权限」按钮右侧）显示 DeepSeek 账户余额胶囊，并实时更新：

- **余额展示**：`● 余额 ¥12.29`（跟随主题的中性色药丸，带 1px 描边）
  - 挂载时立即查询；页面可见时每 15 秒自动轮询；窗口重新聚焦、切换会话、每轮对话提交完成后都会自动刷新——余额变化近乎实时。
  - 悬停显示明细（总额 / 充值 / 赠送）。
  - 点击胶囊会在新标签页打开 DeepSeek 开放平台的用量/余额页（`platform.deepseek.com/usage`）。
- **余额预警**：设置 → 通用 → 「余额预警」设置预警金额（存在浏览器 `localStorage`，设为 `0` 关闭）。当主账户余额降到预警值或以下时，胶囊的边框、文字和圆点会变红，并带柔和的呼吸脉冲动画（遵循系统的「减少动态效果」偏好，动画会自动关闭）。
- **数据来源**：服务端路由 `GET /api/dsh/balance` 调用 DeepSeek 官方 `GET {baseURL}/user/balance` 接口，与内置 DeepSeek 模型使用同一套凭据——`DEEPSEEK_API_KEY`（进程环境变量或已存储的凭据），默认请求 `https://api.deepseek.com`，可通过受信任的 `DEEPSEEK_BASE_URL` 启动层覆盖。
- **状态圆点**：绿 = 查询成功；黄 = 查询中；红 = 查询失败（如未配置 API Key，悬停可见原因）；红边框 + 脉冲 = 余额低于预警值。

## Install

The plugin is a DSH profile bundle. From `$DSH_HOME/profiles/web`:

```sh
# link a local checkout
dsh plugin --profile web add "link:<absolute path to this repo>"

# or install straight from GitHub
dsh plugin --profile web add "git+https://github.com/<owner>/dsh-balance-chip.git"
```

Then restart `dsh web` (or relaunch the desktop app). The plugin is
hot-reloadable afterwards: edits to `lib/client.js` are picked up by DSH's
client HMR without a page refresh.

> Note: like all third-party plugins, review the code before installing. The
> host half reads your `DEEPSEEK_API_KEY` credential and sends it only to the
> configured DeepSeek endpoint.

## Layout

```
package.json        # dsh.bundle.patch + dsh.client.web declaration
cordis.patch.yml    # loader entry insertion
lib/index.js        # host half: balance route (ESM, runs in the web server)
lib/client.js       # client half: ModuleLoader bundle (runs in the browser)
```

## Status legend

- green dot — balance fetched successfully.
- amber dot — fetching.
- red dot — lookup failed (e.g. no `DEEPSEEK_API_KEY` credential yet); hover
  shows the reason.
- red border + pulsing — balance at or below the configured alert threshold.

## License

MIT
