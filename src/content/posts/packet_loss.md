---
title: Is Packet Loss Critical?
published: 2026-05-01
description: ''
image: ''
tags: [packetloss, networking]
category: thoughts
draft: false
lang: en
---

:::note
This is the record for a debate. The opinions might be subjective and one-sided.
:::

## The Introduction

Modern networking infrastructure is built on the TCP/IP architecture, where loss of packets naturally occurs in the network layer and below due to various reasons, such as the bit error in the physical layer, frame loss in the MAC layer and congestion in the network layer. Transport layer is designed to compensate for this problem by retransmission and other mechanisms. While in recent years the academia attempts to design a more powerful network layer with zero packet loss, i.e. the lossless network, **we argue that packet loss is not so critical that we need to design a new network to eliminate it.**

## Success of the Current Internet

The success of the TCP/IP architecture has proved that the Internet throughout the whole world can thrive and function well above a lossy network layer. With sophisticated design by the engineers, packet loss that occurs all the time becomes transparent to the users in the application layer. That is the design philosophy of the network architecture - decoupling the whole network into several layers, and each layer focuses on its own thing. Lossless network is actually trying to mix up the current network and the transport layer, which is a violation to the decoupling methodology.

## Trade-Off: There are More Things to Concern About

When we say something is *critical*, we are actually making comparisons, that is, we put this factor prior to others in our system design, and we sacrifice other matrices to satisfy this factor. Apparently, that is not the case for the packet loss. Engineers simply accepted that network is imperfect and packet loss is inevitable. 

The industry is usually more concerned about the complexity of the system, the difficulty of deployment, the robustness and the power consumption. When facing a real network, an engineer will probably ask, '*Is this network easy to deploy? How much will it cost?*' instead of '*What percentage of packet is discarded during transmisson?*'

## Summary

The current Internet is the best practice of how a lossy network can support reliable communication. Any attempts to build a lossless network is not realistic because the cost is much greater than the reward.