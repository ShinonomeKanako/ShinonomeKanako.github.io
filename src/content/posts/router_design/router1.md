---
title: "BPP Router 1 - A Router That Trims Instead of Drops"
published: 2026-04-28
description: "Traditional routers drop entire packets when buffers overflow. This post introduces an alternative design — importance-aware payload trimming — and the motivation behind building a small prototype around it."
image: ''
tags: [networking, eBPF, XDP, "New IP"]
category: router-design
draft: false
lang: en
---

This is the first post in a three-part series. Here I describe the problem I set out to solve and the high-level design direction I settled on. Parts 2 and 3 will go into the implementation details.

---

## The Problem: Drop Everything or Keep Everything

When a router's buffer fills up under load, the standard response is brutal: start dropping packets. The common strategy — drop-tail — simply discards whatever arrives when the queue is full. More sophisticated mechanisms like RED (Random Early Detection) or CoDel try to be smarter about *when* to drop, but they still operate at the packet level. A packet either gets through or it doesn't.

This is fine for traditional traffic. For a file transfer, a lost TCP segment is annoying but recoverable — the sender will retransmit. But a growing class of applications cares about *latency* more than *reliability*:

- **Autonomous vehicles** share sensor fusion data with nearby nodes. A delayed frame is often useless even if it eventually arrives.
- **Distributed AI training** synchronizes gradients across nodes. Stale gradients from a lagging worker can destabilize the training run.
- **Video streaming** has frames with wildly different importance — keyframes are essential, while B-frames are supplementary refinements.

For these workloads, dropping an entire packet can be far more destructive than necessary. A video frame that loses its low-priority enhancement data is still watchable. A frame that disappears completely may cause a decoder to stall or corrupt subsequent frames.

---

## Why Existing Solutions Don't Quite Fit

The obvious question: haven't people already solved congestion control?

**Active Queue Management (AQM)** methods like RED and CoDel are well-studied and widely deployed. They help reduce queuing delay by proactively signaling congestion. But they still operate at packet granularity — they decide whether to *admit* a packet, not how to reshape it.

**ECN (Explicit Congestion Notification)** allows routers to mark packets instead of dropping them, telling the sender to slow down. This is elegant, but it requires the sender to cooperate. It also does nothing for the packets already in flight when congestion hits.

**SDN-based approaches** (using OpenFlow, P4, etc.) can enforce sophisticated per-flow policies. But they require a centralized controller that talks to every router. That's a real single point of failure, and the control-plane round trips add latency in fast-changing conditions.

What I wanted was something *node-autonomous* — a router that can make intelligent decisions locally, without phoning home to a controller.

---

## A Different Starting Point: Packets with Importance Levels

The core insight is simple: if the payload itself carries metadata about what parts of it matter most, a router under pressure can make a finer-grained decision than "keep or drop."

This is essentially what the **Big Packet Protocol (BPP)**, part of the New IP research agenda, proposes. A BPP packet's payload is divided into *chunks*, each with an importance level. A chunk with higher importance carries data that should survive congestion. Lower-importance chunks are candidates for trimming.

The packet also carries a *contract* — a small header that declares whether the packet is cleanable, what the minimum importance threshold is, and how many times it has already been trimmed.

```c title="common/newip.h"
struct __attribute__((packed)) newip_contract {
    uint8_t  flags;        /* bit7: cleanable, bit6: want_clean */
    uint8_t  threshold;    /* keep chunks at or above this level */
    uint8_t  clean_count;  /* incremented each time a router trims */
};

struct __attribute__((packed)) newip_chunk_hdr {
    uint8_t  importance;   /* chunk priority level */
    uint8_t  length;       /* data bytes in this chunk */
    uint16_t checksum;     /* RFC 1071 checksum over data */
};
```

The packet is encapsulated inside a standard IPv4 frame using IANA experimental protocol number 253, so it passes through legacy routers without modification. Only routers that understand BPP will inspect the inner structure.

The overall packet layout looks like this:

```
New IP packet (abstract model)
┌─────────────────┬──────────────────┬───────────────────┬──────────────────┐
│  New IP Header  │  Contract Spec   │   Shipping Spec   │   Payload Spec   │
└────────┬────────┴────────┬─────────┴─────────┬─────────┴────────┬─────────┘
         │                  ╲                  ╱                   │
         │                   ╲                ╱                    │
         ▼                    ▼              ▼                     ▼
┌─────────────────┬──────────────────┬───────────────────┬──────────────────┐
│ Original IP Hdr │  Contract Spec   │  Offset Pointers  │  Chunked Payload │
│                 ├──────────────────┴───────────────────┴──────────────────┤
│                 │                    Original IP Payload                   │
└─────────────────┴─────────────────────────────────────────────────────────┘
IP packet (on the wire)
```

The New IP abstract model maps onto a plain IPv4 frame: the contract, offset pointer fields, and chunked payload all sit inside the IPv4 payload area. Legacy routers see a normal IP packet and forward it untouched; only BPP-aware nodes inspect the inner structure.

The key benefit: the sender decides upfront what parts of its payload are expendable. When a router trims the tail of the packet, it's not guessing — it's following the sender's own declared preference.

---

## Initial Design Directions and What Didn't Work

My first instinct was to implement the router logic using Linux **traffic control** (`tc`). The `tc` subsystem supports attaching BPF programs via `cls_bpf`, which seemed like a natural fit. But `tc` operates *after* the kernel has already built an `sk_buff` for the packet — that allocation cost happens regardless of what we do to the packet afterward. For a high-throughput forwarding path, this felt wasteful.

**XDP (eXpress Data Path)** hooks into the network driver layer, *before* any kernel protocol processing. The BPF program runs as soon as the packet DMA completes, with direct access to the raw frame buffer. If we decide to drop or trim the packet, we do it before a single byte of kernel socket infrastructure is touched.

Here is where each hook sits in the Linux packet path:

```
         Ingress path                          Egress path
         ─────────────                         ────────────

    ┌─────────────────────┐
    │   NIC driver (RX)   │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐              ┌─────────────────────┐
    │   XDP hook  ◀ USED  │              │   tc qdisc  ✗ SKIP  │
    │─────────────────────│              │─────────────────────│
    │ · token bucket sim  │              │ · whole-packet drop │
    │ · packet trimming   │      │──────>│ · delay control     │
    │ · throughput stats  │      │       │ · throughput stats  │
    └──────────┬──────────┘      │       └──────────┬──────────┘
    XDP_DROP ◀─┤                 │                  │
               │                 │                  ▼
               ▼                 │       ┌─────────────────────┐
    ┌─────────────────────┐      │       │   NIC driver (TX)   │
    │  Kernel IP stack    │───────       │   routing + fwd     │
    │  routing + fwd      │              └─────────────────────┘
    └─────────────────────┘
```

The tradeoff is that XDP programs are more constrained: the BPF verifier enforces strict memory safety, loops must have provably bounded iteration counts, and you can't call arbitrary kernel functions. These constraints are manageable with care, and they're actually a good forcing function for keeping the fast path lean.

The other question was: *how does the router know when to start trimming?* It can't see the buffer fill level of the next hop, and I didn't want to rely on any out-of-band control channel. My answer was to use a **token bucket** as a local congestion proxy — effectively simulating a rate limit, and using the token level as a signal for how close we are to saturation. When tokens run low, increase the trimming probability. When they recover, back off. I'll cover this in detail in Part 2.

---

## What's in This Series

- **Part 1 (this post)**: Problem statement and high-level design rationale.
- **Part 2**: The token bucket congestion model, XDP vs `tc` tradeoffs, and the kernel/userspace split for the control loop.
- **Part 3**: The New IP packet format in detail, and how the XDP program physically trims packets using `bpf_xdp_adjust_tail()`.

The full implementation is a containerized simulation — four nodes (sender, two routers, receiver) running in [Containerlab](https://containerlab.dev/) on a single Linux host. The routers run both a kernel-space XDP program and a userspace daemon that manages the token bucket and adjusts cleaning probability in a feedback loop.

:::note
This project was completed as part of my undergraduate thesis. The goal was a working prototype to validate the design, not a production system — so some rough edges remain.
:::