# web_bz

`web_bz` 是一个基于 React + TypeScript + Vite 的浏览器端布里渊区可视化工具。它可以直接解析 POSCAR，计算第一布里渊区，展示 XCrySDen 风格的特殊点，并支持编辑与导出 K-path。

## 在线部署

项目当前部署在：

**https://bz.cquctcmp.com/**

## 功能概览

- 在浏览器中直接解析 POSCAR 文本
- 计算第一布里渊区并显示 3D 可视化结果
- 展示中心点、顶点、边中点、面心等特殊点
- 支持选择特殊点并构建可编辑的 K-path
- 导出 reciprocal fractional 坐标格式的路径结果

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

如需固定本地地址进行浏览器调试：

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

## 构建与测试

生产构建：

```bash
npm run build
```

运行测试：

```bash
npm run test
```

本项目使用 `vitest`，核心测试集中在 `src/lib/*.test.ts`。

## 项目结构

- `src/components/`: 界面组件与交互面板
- `src/lib/`: POSCAR、几何计算、K-path、数学工具与样例数据
- `src/App.tsx`: 主界面布局
- `src/styles.css`: 全局样式与工作台布局

## 技术栈

- React 18
- TypeScript
- Vite
- Vitest
