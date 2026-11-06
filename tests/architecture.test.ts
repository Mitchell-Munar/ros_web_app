import { ESLint } from 'eslint';
import { expect, test } from 'vitest';
const eslint = new ESLint();
const violations = [
 ['src/core/robot/probe.ts', "import React from 'react'; export { React };"],
 ['src/features/diagnostics/probe.ts', 'export const value = import.meta.env.VITE_USE_MOCK;'],
 ['src/types/probe.ts', 'export const value: any = 1;'],
 ['src/core/robot/probe.ts', "export { Diagnostics } from '../../features/diagnostics';"],
 ['src/app/probe.ts', "export { Connection } from '../core/robot/connection';"],
 ['src/shared/probe.ts', "export { Connection } from '../core/robot';"],
 ['src/features/diagnostics/probe.ts', "export { Connection } from '../../core/robot';"],
];
test.each(violations)('rejects forbidden architecture in %s: %s', async (filePath, code) => {
 const [result] = await eslint.lintText(code, { filePath });
 expect(result.errorCount).toBeGreaterThan(0);
});
test('permits a feature to consume the robot interface', async () => {
 const [result] = await eslint.lintText("import type { TelemetrySource } from '../../core/robot'; export type Source = TelemetrySource;", { filePath: 'src/features/diagnostics/probe.ts' });
 expect(result.messages).toEqual([]);
});
