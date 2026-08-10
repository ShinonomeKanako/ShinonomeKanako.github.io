---
title: Muduo - General Framework
published: 2026-05-02
description: ''
image: ''
tags: [muduo, networking]
category: tech
draft: false
lang: en
---

> Channel类则封装了一个 [fd] 和这个 [fd感兴趣事件] 以及事件监听器监听到 [该fd实际发生的事件]。

> 你 → events_  → 告诉 epoll "我想监听什么"  
epoll → revents_ → 告诉你 "实际发生了什么"  

两者不一样是正常的，因为内核可能通知你比你要求的更多（比如错误、断连），也可能只通知你关心的一部分（比如你关心读写，但这次只有读）。