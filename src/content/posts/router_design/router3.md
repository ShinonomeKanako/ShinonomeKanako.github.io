---
title: "Packet Format Design and In-Kernel Trimming"
published: 2026-04-28
description: "How the New IP packet format encodes importance metadata inside a standard IPv4 frame, and how an XDP program walks the chunk list and physically shrinks packets in-kernel."
image: ''
tags: [networking, eBPF, XDP, "New IP", BPF]
category: router-design
draft: false
lang: en
---

This is Part 3 of a three-part series. [Part 1](../router1) introduced the problem and design rationale. [Part 2](../router2) covered the token bucket congestion model and the kernel/userspace split. Here I get into the details of the packet format and the actual trimming code.

---

## The Simulation Environment

Before diving into the protocol, a quick note on where all of this runs. The lab is a four-node linear network simulated with [Containerlab](https://containerlab.dev/) on a single Linux host:

```
 10.0.1.0/30          10.0.2.0/30          10.0.3.0/30
sender ──────── router1 ──────── router2 ──────── receiver
10.0.1.1     .2   .1          .2   .1          .2  10.0.3.2
```

Each node is a Linux container running a custom image built on top of FRRouting. The topology is declared in a single YAML file:

```yaml title="lab.yml"
name: newip-lab
topology:
  nodes:
    sender:
      kind: linux
      image: newip-router:latest
    router1:
      kind: linux
      image: newip-router:latest
    router2:
      kind: linux
      image: newip-router:latest
    receiver:
      kind: linux
      image: newip-router:latest
  links:
    - endpoints: ["sender:eth1",   "router1:eth1"]
    - endpoints: ["router1:eth2",  "router2:eth1"]
    - endpoints: ["router2:eth2",  "receiver:eth1"]
```

The build pipeline for the router image looks like this:

```
  FRRouting base image
         │
         │ install libbpf, clang, build tools
         ▼
  newip-router:latest ──► containerlab YAML brings up topology
                                    │
                    ┌───────────────┘
                    │ source tree copied into each node
                    ▼
            compile inside node
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  forwarder.bpf.o        forwarder_user
  (BPF bytecode)         (userspace binary)
          │                    │
          └─────────┬──────────┘
                    ▼
          loaded onto XDP hook (eth1 / eth2)
```

Copying the source into the container and compiling there means the BPF bytecode is always built against the exact kernel headers of the running node — no host/container ABI mismatch.

---

## The Protocol Design Challenge

The trimming idea requires every packet to carry some metadata: is this packet trimmable at all? What is the minimum importance level to preserve? Where do the chunk boundaries sit?

The hard constraint: **the framing must survive legacy routers untouched.** A router that knows nothing about BPP must still forward the packet correctly. The solution is to encapsulate the entire BPP structure inside the IPv4 payload, using IANA experimental protocol number `253` to identify it:

```
Ethernet frame
└── IPv4 header (protocol = 253)
    └── New IP payload
        ├── Contract   (3 bytes)  ← cleaning policy
        ├── Pointers   (3 bytes)  ← offset table
        └── Chunks     (variable) ← importance-ranked data blocks
```

A legacy router sees a standard IPv4 packet with an unfamiliar protocol number. It forwards it normally. A BPP-aware router checks `iph->protocol == 253`, then parses the inner structure.

### The Header Layout

The six fixed bytes that begin every New IP payload break into two structs:

```c title="common/newip.h"
struct __attribute__((packed)) newip_contract {
    uint8_t  flags;        /* bit7=cleanable, bit6=want_clean */
    uint8_t  threshold;    /* keep chunks with importance >= this */
    uint8_t  clean_count;  /* how many routers have already trimmed */
};

struct __attribute__((packed)) newip_pointers {
    uint8_t ptr_contract;  /* fixed: offset 2 (end of contract) */
    uint8_t ptr_pointer;   /* fixed: offset 5 (end of pointers) */
    uint8_t ptr_payload;   /* end offset of last chunk — updated on trim */
};
```

`ptr_payload` is the key field for trimming: it records the byte offset of the last byte of the last chunk, relative to the start of the New IP header. After a trim, this field is rewritten to point to the new end. The total New IP length is always `ptr_payload + 1`.

### The Chunk Layout

Each chunk in the payload has a 4-byte header followed by its data:

```c title="common/newip.h"
struct __attribute__((packed)) newip_chunk_hdr {
    uint8_t  importance;   /* priority: higher = more critical */
    uint8_t  length;       /* bytes of data following this header */
    uint16_t checksum;     /* RFC 1071 checksum over data only */
};
```

Chunks are ordered from highest to lowest importance. A router walks from the front and finds the first chunk whose importance falls below `threshold` — everything from that chunk onward is expendable. The trim point is the start of that chunk.

```
Before trim (threshold = 2):

  ┌──────────┬────────┬──────────┬────────┬──────────┬────────┐
  │ chunk hdr│  data  │ chunk hdr│  data  │ chunk hdr│  data  │
  │ imp=5    │ 20 B   │ imp=3    │ 15 B   │ imp=1    │ 10 B   │
  └──────────┴────────┴──────────┴────────┴──────────┴────────┘
                                           ▲
                                    trim point (imp < threshold)

After trim:

  ┌──────────┬────────┬──────────┬────────┐
  │ chunk hdr│  data  │ chunk hdr│  data  │
  │ imp=5    │ 20 B   │ imp=3    │ 15 B   │
  └──────────┴────────┴──────────┴────────┘
```

---

## Finding the Trim Point

The function `plan_packet_clean()` walks the chunk list and returns a plan struct describing where to cut:

```c title="forwarder/forwarder.bpf.c"
struct clean_plan {
    int cut_off_rel;      /* byte offset of the trim point (from New IP start) */
    int trimmed_bytes;    /* how many bytes to remove from the tail */
    __u8 new_ptr_payload; /* updated ptr_payload value after trim */
};

static __always_inline int plan_packet_clean(void *data, void *data_end,
                                             int ip_payload_off,
                                             __u8 threshold,
                                             struct clean_plan *plan)
{
    __u8 *newip = (__u8 *)data + ip_payload_off;
    int payload_end = newip_declared_len(newip, data_end);
    if (payload_end < 0)
        return 0;

    int off = NEWIP_HDR_SIZE;  /* start after the 6-byte fixed header */

#pragma unroll
    for (int i = 0; i < 8; i++) {           /* max 8 chunks */
        if (payload_end - off < CHUNK_HDR_SIZE) break;
        if ((void *)(newip + off + CHUNK_HDR_SIZE) > data_end) break;

        struct newip_chunk_hdr *chdr = (struct newip_chunk_hdr *)(newip + off);
        __u8 importance = chdr->importance;
        __u8 dlen       = chdr->length;
        int  chunk_total = CHUNK_HDR_SIZE + dlen;

        if ((void *)(newip + off + chunk_total) > data_end) break;

        if (importance < threshold) {
            plan->cut_off_rel    = off;
            plan->trimmed_bytes  = payload_end - off;
            plan->new_ptr_payload = (__u8)(off - 1);
            return 1;             /* trim point found */
        }
        off += chunk_total;
    }
    return 0;  /* nothing to trim */
}
```

Two things stand out here that are directly caused by BPF verifier requirements:

**`#pragma unroll`** — the BPF verifier cannot handle loops with runtime-variable iteration counts unless they can be proven to terminate. `#pragma unroll` forces the compiler to unroll the loop into a straight-line sequence of eight identical blocks, each with its own bounds checks. The eight-chunk limit is a practical ceiling that covers all the test cases; anything longer would be handled by a future extension.

**Explicit bounds checks before every dereference** — `(void *)(newip + off + CHUNK_HDR_SIZE) > data_end` and the equivalent check for `chunk_total` must appear before each pointer read. The verifier tracks the possible range of every pointer value and rejects programs that dereference memory without proof that it lies within the packet buffer. Skip one check and the program won't load.

---

## Applying the Trim

Once we have a plan, `apply_packet_clean()` performs three operations in sequence:

```c title="forwarder/forwarder.bpf.c"
static __always_inline int apply_packet_clean(struct xdp_md *ctx,
                                              int ip_payload_off,
                                              const struct clean_plan *plan)
{
    /* 1. Physically shrink the packet */
    if (bpf_xdp_adjust_tail(ctx, -plan->trimmed_bytes) != 0)
        return 0;

    /* ctx->data and ctx->data_end have changed — re-derive pointers */
    void *data     = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;
    __u8 *newip    = (__u8 *)data + ip_payload_off;

    /* 2. Update New IP header fields */
    __u8 *cc = newip + 2;               /* clean_count field */
    if ((void *)(cc + 1) <= data_end)
        (*cc)++;                         /* record that this router trimmed */

    __u8 *ptr_payload = newip + 5;
    if ((void *)(ptr_payload + 1) <= data_end)
        *ptr_payload = plan->new_ptr_payload;

    /* 3. Fix the IPv4 header: length and checksum */
    struct iphdr *iph = (struct iphdr *)((__u8 *)data + sizeof(struct ethhdr));
    if ((void *)(iph + 1) <= data_end) {
        int new_ip_len = (int)((long)data_end - (long)data) - sizeof(struct ethhdr);
        iph->tot_len = bpf_htons((__u16)new_ip_len);
        iph->check   = 0;
        if (iph->ihl == 5)
            iph->check = ipv4_csum_20b(iph);  /* recompute over 20-byte header */
    }

    return plan->trimmed_bytes;
}
```

### Step 1: `bpf_xdp_adjust_tail()`

This is the XDP call that actually shrinks the packet. A negative argument moves the `data_end` pointer backward by that many bytes, effectively removing the tail of the frame buffer in-place. No copy, no allocation — just a pointer update on the DMA buffer the NIC already holds.

After this call, `ctx->data` and `ctx->data_end` reflect the new (shorter) packet. Any pointer derived before the call is stale and must be re-derived, which is why the function reads them again immediately after.

### Step 2: Update the New IP header

Two fields need updating. `clean_count` is incremented so downstream nodes know the packet has already been trimmed. `ptr_payload` is rewritten to `off - 1` — the byte offset just before the trim point — so that any downstream BPP-aware node correctly reads the new packet length without inspecting every chunk.

### Step 3: Recompute the IPv4 checksum

The IPv4 header carries a checksum over its own 20 bytes (for a standard header with no options). Changing `tot_len` invalidates it, so we zero the field and recompute from scratch:

```c title="forwarder/forwarder.bpf.c"
static __always_inline __u16 ipv4_csum_20b(struct iphdr *iph)
{
    __u32 sum = 0;
    __u16 *p  = (__u16 *)iph;
#pragma unroll
    for (int i = 0; i < 10; i++)   /* 20 bytes = 10 × 16-bit words */
        sum += (__u32)p[i];

    sum = (sum & 0xFFFF) + (sum >> 16);
    sum = (sum & 0xFFFF) + (sum >> 16);
    return (__u16)(~sum);
}
```

Again `#pragma unroll` for the verifier. Because we only ever deal with standard 20-byte IPv4 headers (`ihl == 5`), the loop count is fixed and the unroll is straightforward.

---

## Putting It All Together

The main XDP entry point ties everything together:

```c title="forwarder/forwarder.bpf.c" {6-8,14-19}
if (iph->protocol == NEWIP_PROTO) {
    __u8 flags    = newip[0];
    int cleanable = (flags >> 7) & 1;
    if (!cleanable) return XDP_PASS;   /* ACK packets: always pass through */

    __u32 ratio = get_clean_ratio();   /* read from BPF map */
    int should_clean = (ratio >= 10000) ? 1
                     : (ratio > 0 && (__u32)bpf_ktime_get_ns() % 10000 < ratio);

    __u32 effective_len = (__u32)nip_len;
    if (should_clean) {
        __u8 threshold = newip[1];
        struct clean_plan plan = {0};
        if (plan_packet_clean(data, data_end, ip_payload_off, threshold, &plan))
            effective_len = (__u32)(nip_len - plan.trimmed_bytes);
        if (plan.trimmed_bytes > 0)
            apply_packet_clean(ctx, ip_payload_off, &plan);
    }

    if (!try_consume_token(effective_len)) return XDP_DROP;
    return XDP_PASS;
}
```

The token check happens *after* trimming, so a trimmed packet consumes fewer tokens than the original. This means trimming directly extends how long the router can sustain traffic before dropping — which is exactly the point.

---

## Wrapping Up the Series

Across these three posts, the system goes from concept to running code:

1. **The problem**: traditional drop-tail is too blunt for importance-aware traffic. New IP/BPP gives packets a way to say "trim me here if needed."
2. **The control loop**: a token bucket acts as a local congestion proxy. XDP enforces decisions; a userspace daemon adjusts the cleaning probability in a 50 ms feedback loop.
3. **The mechanics**: the BPP packet format encodes chunk importance compactly inside a standard IPv4 frame. The XDP program finds the trim point with a bounded loop, calls `bpf_xdp_adjust_tail()`, and patches up the headers.

The complete source is available in the lab directory. The containerlab topology can be brought up with a single `clab deploy` command, and each node compiles and loads its own XDP program at startup.

:::note
There are obvious limitations in this prototype: the topology is a single linear path, there is no per-flow fairness, and the token bucket parameters are hand-tuned for the test traffic. The interesting open problems — multi-path topologies, per-flow tracking, coupling with routing protocols — are left for future work.
:::
