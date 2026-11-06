import path from 'node:path';
import ts from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(...ts.configs.recommended, {
 files: ['src/**/*.{ts,tsx}'],
 plugins: { architecture: { rules: { imports: { create(context) { return { 'ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration'(node) { const spec = node.source?.value; if (typeof spec !== 'string' || !spec.startsWith('.')) return; const from = path.relative(process.cwd(), context.filename).split(path.sep); const to = path.relative(process.cwd(), path.resolve(path.dirname(context.filename), spec)).split(path.sep); const module = parts => parts[1] === 'features' || parts[1] === 'core' ? parts.slice(0,3).join('/') : parts.slice(0,2).join('/'); if (from.join('/') === 'src/main.tsx' && to.join('/') === 'src/app') return; if (module(from) === module(to)) return; const allowed = { app: ['features','core','types','shared'], features: ['core','shared'], core: ['types','shared'], types: [], shared: [] }; if (!allowed[from[1]]?.includes(to[1])) context.report({ node, message: 'Forbidden layer or cross-feature dependency.' }); const rest = to.slice(to[1] === 'core' || to[1] === 'features' ? 3 : 2); if (rest.length && !/^index(?:\.tsx?)?$/.test(rest.join('/'))) context.report({ node, message: 'Import through the module index.' }); } }; } } } }, boundaries, 'react-hooks': hooks },
 settings: { 'import/resolver': { typescript: {} }, 'boundaries/elements': [
 { type: 'app', pattern: 'src/app', mode: 'folder' },
 { type: 'feature', pattern: 'src/features/*', mode: 'folder' },
 { type: 'core', pattern: 'src/core/*', mode: 'folder' },
 { type: 'types', pattern: 'src/types', mode: 'folder' },
 { type: 'shared', pattern: 'src/shared', mode: 'folder' }
 ] },
 rules: { 'architecture/imports': 'error', ...hooks.configs.recommended.rules,
 'boundaries/element-types': ['error', { default: 'disallow', rules: [
 { from: 'app', allow: ['feature','core','types','shared'] },
 { from: 'feature', allow: ['core','shared'] },
 { from: 'core', allow: ['types','shared'] }
 ] }],
 'boundaries/entry-point': ['error', { default: 'disallow', rules: [{ target: ['app','feature','core','types','shared'], allow: ['index.ts','index.tsx'] }] }]
 }
}, { files: ['src/**/*.{ts,tsx}'], ignores: ['src/app/config/**'], rules: { 'no-restricted-syntax': ['error', { selector: "MemberExpression[object.type='MetaProperty'][property.name='env']", message: 'Read environment only in app/config.' }] } }, { files: ['src/features/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { paths: [{ name: '../../core/robot', importNames: ['Connection','Mock','getRobotSession','disposeSessions'], message: 'Features consume interfaces only.' }], patterns: ['node:*','electron','@tauri-apps/*'] }], 'no-restricted-properties': ['error', { object: 'window', property: 'electron', message: 'Use a platform port.' }] } }, { files: ['src/core/**','src/types/**'], rules: { 'no-restricted-imports': ['error', { patterns: ['react','react/*','react-dom','react-dom/*'] }] } });
