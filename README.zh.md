# dsh-balance-chip

[English](README.md) | [中文](README.zh.md)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web
客户端插件：在对话框输入框的左下角（「切换权限」按钮右侧）显示 DeepSeek 账户余额，
并实时更新。

## 功能说明

- **余额展示**：`● 余额 ¥14.07`（跟随主题的中性色药丸，带 1px 描边）
  - 挂载时立即查询；页面可见时每 15 秒自动轮询；窗口重新聚焦、切换会话、每轮对话提交完成后都会自动刷新——余额变化近乎实时。
  - 悬停显示明细（总额 / 充值 / 赠送）。
  - 点击胶囊会在新标签页打开 DeepSeek 开放平台的用量/余额页（`platform.deepseek.com/usage`）。
- **余额预警**：设置 → 通用 → 「余额预警」设置预警金额（存在浏览器 `localStorage`，设为 `0` 关闭）。当主账户余额降到预警值或以下时，胶囊的边框、文字和圆点会变红，并带柔和的呼吸脉冲动画（遵循系统的「减少动态效果」偏好，动画会自动关闭）。
- **数据来源**：服务端路由 `GET /api/dsh/balance` 调用 DeepSeek 官方 `GET {baseURL}/user/balance` 接口，与内置 DeepSeek 模型使用同一套凭据——`DEEPSEEK_API_KEY`（进程环境变量或已存储的凭据），默认请求 `https://api.deepseek.com`，可通过受信任的 `DEEPSEEK_BASE_URL` 启动层覆盖。

## 安装

本插件是一个 DSH profile bundle。在 `$DSH_HOME/profiles/web` 目录下：

```sh
# 链接本地仓库
dsh plugin --profile web add "link:<本仓库的绝对路径>"

# 或直接从 GitHub 安装
dsh plugin --profile web add "git+https://github.com/1665482244/dsh-balance-chip.git"
```

然后重启 `dsh web`（或重新打开桌面客户端）。之后插件支持热更新：修改 `lib/client.js` 会被 DSH 的客户端 HMR 自动拾取，无需刷新页面。

> 注意：和所有第三方插件一样，安装前请先审阅代码。服务端半会读取你的 `DEEPSEEK_API_KEY` 凭据，且只会发送到你配置的 DeepSeek 端点。

## 目录结构

```
package.json        # dsh.bundle.patch + dsh.client.web 声明
cordis.patch.yml    # loader 条目插入
lib/index.js        # 服务端半：余额路由（ESM，运行在 web 服务进程里）
lib/client.js       # 客户端半：ModuleLoader 包（运行在浏览器里）
```

## 状态图例

- 绿点 —— 余额查询成功。
- 黄点 —— 查询中。
- 红点 —— 查询失败（例如尚未配置 `DEEPSEEK_API_KEY`）；悬停可见原因。
- 红边框 + 脉冲 —— 余额已降到（或低于）设置的预警值。

## 许可证

MIT
