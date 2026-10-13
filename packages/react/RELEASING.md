# 发布 chem-structura

由 GitHub Actions 自动发布（`.github/workflows/release.yml`），不用令牌、不用在本机登录 npm。

## 一次性设置（已完成后不用再做）

在 npmjs.com 打开 chem-structura → Settings → Trusted Publisher → GitHub Actions，填：

| 项 | 值 |
|---|---|
| Organization or user | `wxyhgk` |
| Repository | `structura` |
| Workflow filename | `release.yml` |
| Environment | 留空 |

## 每次发布

1. 改 `packages/react/package.json` 的 `version`（只修问题用 `0.3.1`；加了或改了接口用 `0.4.0`），在
   `CHANGELOG.md` 最上面写这一版改了什么，README 里写着版本号的 CDN 地址（`chem-structura@…`）
   一起改。
2. 本地先跑一遍（CI 也会跑）：

   ```sh
   npm run typecheck && npm run lint && npm test
   npm run build -w chem-structura && npm run check:dist -w chem-structura
   npm run test:e2e        # 含 standalone.spec.ts、ssr.spec.ts：打好的包在页面里、在服务器上
   ```

3. 合到 master（CI 全部通过）。
4. 在 master 的那个提交上打标签并推送：

   ```sh
   git tag chem-structura@0.3.0
   git push origin chem-structura@0.3.0
   ```

工作流会检查标签和 package.json 的版本一致、提交在 master 上，再跑类型检查、lint、全部测试、构建、
`check:dist`，最后发布（带来源证明）。在 GitHub 的 Actions 页面的 “Release” 里能看到进度。发布后
`https://cdn.jsdelivr.net/npm/chem-structura@<版本>` 就能用（jsDelivr 第一次取可能要等几分钟）。
