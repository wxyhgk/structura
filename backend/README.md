# @structura/backend

Structura 的后端：单用户（暂时没有账号），把用户自己的基团模板存在 SQLite 里。只用 Node 自带的
`node:sqlite` 和 `node:http`，没有别的依赖。内置模板不在这里，它们随应用发布
（`@structura/markush` 的 `builtinTemplates()`）。

接口见 [API.md](./API.md)。

## 运行

在仓库根目录：

```sh
npm run backend
```

启动后会打印地址，默认 `http://127.0.0.1:25174`。开发时另开一个终端跑 `npm run dev`，Vite 会把
`/api/templates` 和 `/api/health` 转发给后端，页面直接请求同源路径即可。按 Ctrl+C 停止。

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `STRUCTURA_BACKEND_PORT` | `25174` | 端口。改了它，跑 `npm run dev` 时也要设成同一个值，Vite 的转发才对得上 |
| `STRUCTURA_BACKEND_HOST` | `127.0.0.1` | 监听地址。只在本机用就别改；没有登录，开到 `0.0.0.0` 等于谁都能改你的模板 |
| `STRUCTURA_DB` | `backend/data/structura.db` | 数据库文件。相对路径按启动时的当前目录算；文件夹不存在会自动创建 |

例如：

```sh
STRUCTURA_BACKEND_PORT=25190 STRUCTURA_DB=~/structura/templates.db npm run backend
```

## 数据放在哪

默认在 `backend/data/structura.db`（已加进 `.gitignore`，不会被提交）。数据库开了 WAL 模式，
所以运行时旁边还会有 `structura.db-wal` 和 `structura.db-shm` 两个文件，属于正常现象。

表结构由 `src/db.ts` 里的迁移管理，版本号记在 `PRAGMA user_version`。旧的数据库文件打开时会自动
升级；比当前代码更新的数据库会拒绝打开，免得把数据弄坏。

## 备份和迁移

两种办法，任选：

1. **导出 JSON**（推荐，可跨版本、可给别人）：

   ```sh
   curl -o structura-templates.json http://127.0.0.1:25174/api/templates/export
   ```

   恢复或合并到另一个库：

   ```sh
   curl -X POST -H 'Content-Type: application/json' \
     --data @structura-templates.json http://127.0.0.1:25174/api/templates/import
   ```

   导入时内容完全相同的模板会跳过，不会重复；有问题的模板会列在 `problems` 里，其余照常导入。

2. **复制数据库文件**：先停掉后端，再把 `structura.db` 复制走（停掉后 `-wal` 文件的内容已经并回主文件）。
   如果必须在运行中复制，就连同 `structura.db-wal` 一起复制。

## 代码结构

- `src/main.ts`：读配置、打开数据库、启动服务
- `src/config.ts`：环境变量
- `src/db.ts`：打开数据库、迁移
- `src/templates.ts`：模板的增删改查、导入导出（只管数据库，校验用 `templateProblem`）
- `src/http.ts`：读 JSON 请求体（上限 2 MB）、写 JSON 回应、错误
- `src/routes.ts`：API.md 里的路由
- `src/server.ts`：`createServer(db)`，测试用端口 0 启动它

## 测试

```sh
npm test -w @structura/backend
```

根目录的 `npm test` 也会跑这些测试。
