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

1. 改 `packages/react/package.json` 的 `version`（如 `0.1.1`；改了接口用 `0.2.0`）。
2. 合到 master（CI 全部通过）。
3. 在 master 的那个提交上打标签并推送：

   ```sh
   git tag chem-structura@0.1.1
   git push origin chem-structura@0.1.1
   ```

工作流会检查标签和 package.json 的版本一致、提交在 master 上，再跑类型检查、lint、全部测试、构建，
最后发布（带来源证明）。在 GitHub 的 Actions 页面的 “Release” 里能看到进度。
