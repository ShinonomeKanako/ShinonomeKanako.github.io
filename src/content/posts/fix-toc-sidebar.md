---
title: 在 Fuwari 模板中将目录侧边栏移至左侧
published: 2026-04-27
description: '本文记录了在 Fuwari 博客模板中排查目录（TOC）不显示的问题，并将其从右侧浮动面板迁移到左侧 sidebar 的完整过程，包括对 Swup 页面切换导致显示异常的深层修复。'
image: ''
tags: [Fuwari, Astro, Swup, 调试]
category: tech
draft: false
lang: zh_CN
---

## 发现问题：目录栏不见了

搭好 [Fuwari](https://github.com/saicaca/fuwari) 博客后，在文章页面始终找不到目录（TOC）侧边栏。按照 `src/config.ts` 里的配置，`toc.enable` 是 `true`，理论上应该显示。

翻了一下 `src/components/widget/TOC.astro` 和 `src/layouts/MainGridLayout.astro`，找到了渲染目录的代码片段：

```astro title="src/layouts/MainGridLayout.astro"
<div class="absolute w-full z-0 hidden 2xl:block">
    <div class="relative max-w-[var(--page-width)] mx-auto">
        <div id="toc-wrapper" class="...">
            <div id="toc-inner-wrapper" class="fixed top-14 ...">
                <div id="toc" class="transition-swup-fade">
                    <TOC headings={headings}></TOC>
                </div>
            </div>
        </div>
    </div>
</div>
```

关键在第一行：`hidden 2xl:block`。这意味着目录只在视口宽度达到 **2xl（1536px）** 时才会显示。我的 13 英寸 Mac 浏览器视口大约是 1280px，永远达不到这个门槛。

---

## 尝试降低屏幕宽度要求

第一反应是直接把 `2xl:block` 改小：

```diff
- <div class="absolute w-full z-0 hidden 2xl:block">
+ <div class="absolute w-full z-0 hidden xl:block">   <!-- 1280px -->
```

部署后目录确实出现了，但极其细窄——几乎只有几个像素宽。

原因在于目录宽度的计算方式：

```css title="src/styles/variables.styl"
--toc-width: calc((100vw - var(--page-width)) / 2 - 1rem)
```

页面内容宽度（`--page-width`）是 75rem = 1200px。在 1280px 视口下：

$$
\text{TOC 宽度} = \frac{1280 - 1200}{2} - 16 = 24\text{px}
$$

24px 的目录栏显然没有实用价值。继续缩小到 `lg:block`（1024px），宽度直接变成负数，完全错位。

---

## 换个思路：把目录移到左侧

观察页面布局，文章页左侧有一列 sidebar，包含 Profile、Categories、Tags。这一列在 lg（1024px）以上屏幕宽度时固定占 **17.5rem（280px）**，空间远比右侧边距充裕。

查看代码发现，`headings` 数据已经被传入 `SideBar` 组件，但从未使用：

```astro title="src/layouts/MainGridLayout.astro"
<SideBar
  class="... lg:max-w-[17.5rem] ..."
  headings={headings}   <!-- 已经传入，但 SideBar 内没有用到 -->
>
</SideBar>
```

于是决定：**把目录渲染逻辑移进 SideBar，放在 Profile 下方**。

第一版改动如下：

```astro title="src/components/widget/SideBar.astro"
{showToc && (
    <div class="card-base p-4 onload-animation">
        <div id="toc" class="transition-swup-fade">
            <TOC headings={headings}></TOC>
        </div>
    </div>
)}
```

部署后，目录出现在了左侧，位置和宽度都合适。

---

## 新问题：显示效果不稳定

实际使用时发现两个明显异常：

1. **进入文章页后目录不出现，刷新页面才显示**
2. **从文章页跳回首页后，目录位置遗留一个空白白色卡片**

### 定位根本原因

Fuwari 使用 [Swup](https://swup.js.org/) 实现无刷新页面切换，其更新容器配置为：

```js title="astro.config.mjs"
containers: ["main", "#toc"],
```

Swup 在每次页面切换时，只替换 `main` 和 `#toc` 两个容器的内容，**sidebar 不在更新范围内**。

**问题一（空白卡片）的根因**：

```astro
<!-- card-base 在 #toc 外层，Swup 替换 #toc 时不影响它 -->
<div class="card-base p-4">        ← 白色背景，Swup 不动它
    <div id="toc">                 ← 内容被 Swup 清空
        <TOC ...>
    </div>
</div>
```

从文章页跳走后，Swup 把 `#toc` 内的 TOC 链接清空，但外层带白色背景的 `card-base` 依然存在，于是出现空白卡片。

**问题二（需要刷新）的根因**：

`TOC.astro` 的自定义元素初始化逻辑依赖 `#toc-inner-wrapper`：

```js title="src/components/widget/TOC.astro"
init() {
    this.tocEl = document.getElementById("toc-inner-wrapper");
    if (!this.tocEl) return;  // 找不到就放弃初始化
    // ...
}
```

我们的 sidebar 版本没有提供这个 ID，而原有的右侧浮动 TOC（虽然不可见，但 DOM 中仍存在）提供了 `#toc-inner-wrapper`，导致初始化时序混乱，偶发失败。

此外，sidebar 中还引入了 **重复的 `id="toc"`**：

| 位置 | ID |
|---|---|
| `SideBar.astro`（新加） | `id="toc"` |
| `MainGridLayout.astro`（原有右侧，2xl 才显示但 DOM 中存在） | `id="toc"` |
| `MainGridLayout.astro`（fallback） | `id="toc"` |

`querySelector("#toc")` 只命中第一个，Swup 的行为因此变得不确定。

### 修复方案

核心思路：**把完整的 TOC 结构（含 `#toc-inner-wrapper` 和 `#toc`）只保留在 sidebar 一处，同时把 `card-base` 移进 `#toc` 内部。**

**第一步**：删除 `MainGridLayout.astro` 中整个右侧浮动 TOC 块（约 20 行），消除重复 ID 问题。

**第二步**：重构 `SideBar.astro` 的 TOC 包装结构：

```astro title="src/components/widget/SideBar.astro"
<div id="toc-inner-wrapper">
    <div id="toc" class="transition-swup-fade">
        {showToc && (
            <div class="card-base p-4 onload-animation" style="animation-delay: 100ms">
                <TOC headings={headings}></TOC>
            </div>
        )}
    </div>
</div>
```

关键变化：

- `#toc-inner-wrapper` 始终存在，满足 `TOC.astro` 的 `init()` 依赖
- `#toc` 始终存在，作为 Swup 的唯一更新目标
- `card-base` 移进 `#toc` 内部：Swup 切换页面时，非文章页的 `#toc` 内容为空，`card-base` 随之消失，不会留下空白卡片

`astro.config.mjs` 的 Swup 配置 `containers: ["main", "#toc"]` 不需要修改。

---

## 验收

部署后逐一测试以下场景，全部符合预期：

| 场景 | 结果 |
|---|---|
| 首页 → 文章页（有标题） | TOC 卡片出现，无需刷新，可点击跳转 ✓ |
| 文章页 → 首页 | TOC 卡片消失，无空白遗留 ✓ |
| 文章页 → 文章页 | TOC 内容随当前文章更新 ✓ |
| 直接访问无标题文章 | 无 TOC 卡片 ✓ |
| 直接访问首页 | 无 TOC 卡片 ✓ |
| 滚动文章时 | 当前章节高亮联动正确 ✓ |
