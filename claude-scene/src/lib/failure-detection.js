// Failure-detection helper extracted from runStep so it is unit-testable without
// mounting the full orchestrator (dispatchAction/ora/inquirer). Only flags
// unambiguous failures from a handler's free-text return; non-string results
// return false so a non-string failure is never silently misread.
export function detectHandlerFailure(result) {
  if (typeof result !== 'string') return false;
  const isFailure = /(失败|阻断|abort|FAIL)/i.test(result) &&
                    !/(部分|跳过|继续|非致命|fallback|降级|通知已发送|已保存|已记录|已?通知)/i.test(result);
  return isFailure;
}
