// 「伪动作」：不在 ACTION_REGISTRY 里注册，由引擎自己（交互层 commands/start.js）实现的 action 名。
// 它们出现在 scene JSON 的 `action` 字段里是合法的。
//
// 之所以单独成表：这份名单以前在 handlers/handler-verify.js 里写死一份，而
// scripts/check-dead-actions.cjs 完全不知道它 —— 于是 selectModes / selectSetupKind
// 在 4 个场景里被报成「死引用」（假红），脚本又恒 exit 0（假绿），两个毛病同时存在。
// 现在两边读同一张表：引擎自检、场景—动作核验、死动作扫描都认这一份。
export const PSEUDO_ACTIONS = new Set(['selectModes', 'selectSetupKind']);
