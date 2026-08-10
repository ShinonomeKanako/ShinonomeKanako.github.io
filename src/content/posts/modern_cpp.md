---
title: Modern Features of C++
published: 2026-05-17
description: 'A focused note on the difference between constexpr and consteval in modern C++.'
image: ''
tags: [C++, modern-cpp]
category: tech
draft: false
lang: en
---

`constexpr` and `consteval` both belong to modern C++'s compile-time programming toolbox. They look similar at first, but they answer different questions:

> `constexpr` means "this can be evaluated at compile time."  
> `consteval` means "this must be evaluated at compile time."

That single difference changes how strict the compiler is, where the function can be called, and what kind of API you are designing.

## `constexpr`: Compile-Time If Possible

A `constexpr` function may be evaluated at compile time, but it can also run at runtime when the arguments are not known during compilation.

```cpp title="constexpr_example.cpp" showLineNumbers {3,8,11}
#include <iostream>

constexpr int square(int x) {
    return x * x;
}

int main() {
    constexpr int a = square(4); // compile-time evaluation

    int n;
    std::cin >> n;
    int b = square(n);          // runtime evaluation
}
```

In this example, the same function serves two contexts. `square(4)` can be folded by the compiler, while `square(n)` runs at runtime because `n` comes from user input.

:::note
`constexpr` does not force compile-time execution. It only makes compile-time execution possible when the expression is a constant expression.
:::

This makes `constexpr` a good default for small pure functions, numeric helpers, configuration calculations, and APIs that should remain usable in normal runtime code.

## `consteval`: Compile-Time Only

`consteval` was introduced in C++20. A `consteval` function is an immediate function: every potentially evaluated call to it must produce a compile-time constant.

```cpp title="consteval_example.cpp" showLineNumbers {1,5,9}
consteval int square(int x) {
    return x * x;
}

constexpr int a = square(4); // OK

int main() {
    int n = 5;
    // int b = square(n);    // error: n is not a constant expression
}
```

The compiler rejects `square(n)` because `n` is a runtime variable. Unlike `constexpr`, `consteval` does not provide a runtime fallback.

:::important
Use `consteval` when runtime execution would be a bug, not merely a missed optimization.
:::

## The Core Difference

| Feature | `constexpr` | `consteval` |
|---|---|---|
| Introduced in | C++11 | C++20 |
| Compile-time evaluation | Allowed | Required |
| Runtime calls | Allowed when needed | Not allowed |
| Typical use | General-purpose constant-friendly functions | APIs that must generate compile-time values |
| Failure mode | Falls back to runtime if possible | Compilation error |

The easiest mental model is:

```cpp
constexpr // can be compile-time
consteval // must be compile-time
```

## A Practical Comparison

Imagine we want to compute a buffer size. With `constexpr`, the helper can be used both for fixed constants and runtime decisions.

```cpp title="buffer_size.cpp" showLineNumbers {1,5,10}
constexpr int alignToFour(int n) {
    return (n + 3) / 4 * 4;
}

constexpr int staticSize = alignToFour(13); // OK: compile time

int runtimeSize(int input) {
    return alignToFour(input);              // OK: runtime
}
```

If the value must be known at compile time, `consteval` gives a stronger guarantee.

```cpp title="strict_buffer_size.cpp" showLineNumbers {1,5,9}
consteval int alignToFour(int n) {
    return (n + 3) / 4 * 4;
}

constexpr int staticSize = alignToFour(13); // OK

int runtimeSize(int input) {
    // return alignToFour(input);           // error
    return input;
}
```

Here the API itself prevents runtime use. That is useful when the result is meant for template parameters, generated lookup tables, compile-time validation, or other places where runtime behavior would hide a design mistake.

## `consteval` for Compile-Time Validation

One natural use of `consteval` is forcing validation during compilation.

```cpp title="port_validation.cpp" showLineNumbers {1,2,6,9}
consteval int checkedPort(int port) {
    if (port <= 0 || port > 65535) {
        throw "invalid port";
    }
    return port;
}

constexpr int httpPort = checkedPort(80);
// constexpr int badPort = checkedPort(70000); // compile-time error
```

:::warning
Throwing inside a `consteval` function is not runtime exception handling. If that path is taken during constant evaluation, the program is ill-formed and compilation fails.
:::

This pattern is useful when invalid values should never reach the binary.

## How They Interact

A `consteval` function can be called from a `constexpr` context if the call is still evaluated at compile time.

```cpp title="interaction.cpp" showLineNumbers {1,5,6}
consteval int makeId(int x) {
    return x + 1000;
}

constexpr int idA = makeId(7); // OK
auto idB = makeId(8);          // OK, still compile-time
```

The key is not whether the receiving variable is explicitly marked `constexpr`. The key is whether the call itself can be evaluated immediately.

## When to Use Which

Use `constexpr` when the function is ordinary code that benefits from compile-time evaluation:

- math helpers
- small pure functions
- values shared by compile-time and runtime code
- functions where runtime fallback is acceptable

Use `consteval` when compile-time evaluation is part of the contract:

- compile-time validation
- generated constants
- template or type-level utilities
- APIs where runtime use should be rejected

:::tip
If you are unsure, start with `constexpr`. Reach for `consteval` when you intentionally want the compiler to reject every runtime call.
:::

## `explicit`: Preventing Accidental Conversions

`explicit` is used to prevent implicit conversions through constructors or conversion operators. It is most commonly added to single-argument constructors.

Without `explicit`, C++ may silently convert one type into another:

```cpp title="implicit_conversion.cpp" showLineNumbers {3,10,13}
class UserId {
public:
    UserId(int value) : value(value) {}

private:
    int value;
};

void findUser(UserId id);

int main() {
    UserId id = 42; // OK: int is implicitly converted to UserId
    findUser(7);    // OK, but the intent is not very clear
}
```

Adding `explicit` forces the caller to construct the object deliberately:

```cpp title="explicit_constructor.cpp" showLineNumbers {3,12,13}
class UserId {
public:
    explicit UserId(int value) : value(value) {}

private:
    int value;
};

void findUser(UserId id);

int main() {
    // UserId id = 42;   // error
    UserId id{42};       // OK
    findUser(UserId{7}); // OK
}
```

:::important
Use `explicit` when an implicit conversion would hide meaning. A plain `int` becoming a `UserId`, `Length`, or `Port` should usually be written intentionally.
:::

`explicit` can also be used on conversion operators:

```cpp title="explicit_bool.cpp" showLineNumbers {3,12,13}
class File {
public:
    explicit operator bool() const {
        return opened;
    }

private:
    bool opened = true;
};

int main() {
    File file;
    if (file) {}     // OK in a condition
    // bool ok = file; // error: no implicit conversion to bool
}
```

The general rule is simple: if a constructor represents a meaningful domain conversion, prefer `explicit` unless implicit conversion is truly natural and harmless.

## Summary

`constexpr` makes a function eligible for compile-time evaluation. It is flexible and often works well as a default for simple deterministic code.

`consteval` makes compile-time evaluation mandatory. It is stricter, newer, and best used when runtime execution would make the abstraction weaker or incorrect.

`explicit` prevents accidental implicit conversions. It makes construction and type conversion more intentional, which is especially useful for small wrapper types and domain-specific values.

In short:

```cpp
constexpr int f(); // compile-time capable
consteval int g(); // compile-time required
explicit UserId(int value); // no accidental int-to-UserId conversion
```

Both features help move work from runtime to compilation, but `consteval` also moves responsibility into the type system and compiler diagnostics. That is its real value.
