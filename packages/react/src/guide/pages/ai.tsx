import { P, Steps, Tip } from "../ui/parts.tsx"
import { definePage } from "../types.ts"

export const aiPage = definePage({
  id: "ai",
  group: "AI 助手",
  title: "从专利文字填写",
  keywords: "AI 专利 文字 自动 填写 Claude OpenAI key",
  body: () => (
    <>
      <P>把权利要求里定义变量的那几段文字粘进去，由大模型读出每个变量的候选项。</P>
      <Steps>
        <li>先画好通式，标出变量。</li>
        <li>点面板底部的“从专利文字填写…”（或菜单“AI → 从专利文字填写变量…”），粘贴文字，点“读取”。</li>
        <li>逐个检查：会列出没采用的写法和表达不了、需要人工处理的部分（取代基范围、“相邻基团可成环”等）。</li>
        <li>勾选要用的变量，点“应用”，整个填写算一步，可以撤销。</li>
      </Steps>
      <Tip>需要服务器上配置 API key（项目根目录的 .env.local，见 README）。</Tip>
    </>
  ),
})
