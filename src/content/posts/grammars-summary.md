---
title: Grammars Summary of the Blog Template
published: 2026-04-26
description: '本文总结了 Fuwari 博客模板支持的扩展 Markdown 语法，包括提示块、GitHub 仓库卡片、数学公式和代码块增强功能。'
image: ''
tags: [博客, Markdown]
category: others
draft: false
lang: zh_CN
---

本文总结 Fuwari 模板在标准 Markdown 基础上扩展的语法，方便撰写文章时参考。

## 提示块（Admonitions）

提示块用于突出显示特定类型的信息，共有五种样式。

**源代码：**

```markdown
:::note
这是一个注释。
:::

:::tip
这是一个提示。
:::

:::important
这是重要信息。
:::

:::warning
这是警告信息。
:::

:::caution
这是危险警告。
:::
```

**渲染效果：**

:::note
这是一个注释。
:::

:::tip
这是一个提示。
:::

:::important
这是重要信息。
:::

:::warning
这是警告信息。
:::

:::caution
这是危险警告。
:::

---

## GitHub 仓库卡片

可以渲染一个带有仓库信息（描述、Star 数等）的卡片。

**源代码：**

```markdown
::github{repo="saicaca/fuwari"}
```

**渲染效果：**

::github{repo="saicaca/fuwari"}

---

## 数学公式（KaTeX）

支持 LaTeX 语法的数学公式渲染。

**行内公式源代码：**

```markdown
质能方程：$E = mc^2$
```

**行内公式渲染效果：**

质能方程：$E = mc^2$

**块级公式源代码：**

```markdown
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

**块级公式渲染效果：**

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

---

## 代码块增强（Expressive Code）

所有增强选项写在代码块开头的三个反引号之后。

### 文件名

**源代码：**

````markdown
```js title="example.js"
const a = 1
const b = 2
```
````

**渲染效果：**

```js title="example.js"
const a = 1
const b = 2
```

### 高亮指定行

**源代码：**

````markdown
```js {2,4-5}
const a = 1
const b = 2
const c = 3
const d = 4
const e = 5
```
````

**渲染效果：**

```js {2,4-5}
const a = 1
const b = 2
const c = 3
const d = 4
const e = 5
```

### 标记增删行（diff 风格）

**源代码：**

````markdown
```js
// [!code --]
const old = true
// [!code ++]
const new_ = true
```
````

**渲染效果：**

```js
// [!code --]
const old = true
// [!code ++]
const new_ = true
```

### 显示行号

**源代码：**

````markdown
```js showLineNumbers
const a = 1
const b = 2
const c = 3
```
````

**渲染效果：**

```js showLineNumbers
const a = 1
const b = 2
const c = 3
```

### 可折叠代码段

**源代码：**

````markdown
```js collapse={3-6}
const a = 1
const b = 2
const c = 3
const d = 4
const e = 5
const f = 6
const g = 7
```
````

**渲染效果：**

```js collapse={3-6}
const a = 1
const b = 2
const c = 3
const d = 4
const e = 5
const f = 6
const g = 7
```

### 终端风格

终端代码块不显示行号，使用 `shellsession` 语言标识。

**源代码：**

````markdown
```shellsession
$ pnpm install
$ pnpm dev
```
````

**渲染效果：**

```shellsession
$ pnpm install
$ pnpm dev
```

### 组合使用

多个选项可以同时使用。

**源代码：**

````markdown
```js title="index.js" showLineNumbers {3}
const a = 1
const b = 2
const c = 3
const d = 4
```
````

**渲染效果：**

```js title="index.js" showLineNumbers {3}
const a = 1
const b = 2
const c = 3
const d = 4
```

## Frontmatter 语言字段（lang）

文章 frontmatter 的 `lang` 字段用于声明文章语言，影响页面的 `lang` 属性。留空则继承 `src/config.ts` 中 `siteConfig.lang` 的值。

常用取值（遵循 [IETF 语言标签](https://en.wikipedia.org/wiki/IETF_language_tag) 规范）：

| 值 | 语言 |
|---|---|
| `zh_CN` | 简体中文 |
| `zh_TW` | 繁体中文 |
| `en` | 英语 |
| `ja` | 日语 |
| `ko` | 韩语 |
| `fr` | 法语 |
| `de` | 德语 |
