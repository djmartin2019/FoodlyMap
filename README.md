# Foodly Map 🍽️🗺️  
**A personal, social-first food map — Yelp, but fun.**

![Status](https://img.shields.io/badge/status-active_development-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Cloudflare Pages](https://img.shields.io/badge/deployed%20on-Cloudflare%20Pages-orange)
![TypeScript](https://img.shields.io/badge/types-TypeScript-blue)
![React](https://img.shields.io/badge/frontend-React-61DAFB)
![Mapbox](https://img.shields.io/badge/maps-Mapbox-black)

🌐 **Live Site:** [https://foodlymap.com](https://foodlymap.com)

---

## Overview

**Foodly Map** is a social food discovery app focused on *trusted recommendations* rather than global review overload.

👉 **[Visit the live site →](https://foodlymap.com)**

Instead of browsing thousands of anonymous reviews, users:
- Build a **personal food map**
- Save and organize places they’ve actually enjoyed
- Share discoveries through **mutual friends**
- Explore food like a collection, not a search engine

Think *Pokédex for food*, powered by people you trust.

---

## Problem Statement

Modern food discovery apps suffer from:
- Analysis paralysis
- Low-trust reviews
- Algorithmic noise
- Incentivized spam and over-optimization

Foodly Map flips the model:
- **Your map first**
- **Friends second**
- **Global discovery last (optional)**

---

## Core Principles

- **Personal > Global**
- **Social trust over star ratings**
- **Collection over critique**
- **Dark-mode-first, fast, and mobile-friendly**
- **Progressive Web App (PWA) before native**

---

## MVP Scope (Phased Development)

This repository intentionally follows a **phased MVP approach** to avoid premature complexity.

### Phase 0 — Foundation (Current)
- Cloudflare Pages deployment
- React + TypeScript + Vite
- TanStack Router
- Mapbox map rendering
- Marketing / project dashboard
- Dark-mode neon-green design system

### Phase 1 — Authentication
- Supabase Auth
- Email + OAuth login
- Protected routes

### Phase 2 — Database & Security
- Supabase Postgres schema
- Row Level Security (RLS)
- Core tables:
  - users / profiles
  - places
  - lists
  - list_items
  - friendships
  - visits / confirmations

### Phase 3 — Auth-Gated App Pages
- User dashboard
- Profile + scoreboard
- Friends list

### Phase 4 — Locations
- Manual pin drop on map
- Place metadata (name, tags, notes)
- “I’ve been” / visit confirmation

### Phase 5 — Lists & Social Graph
- Custom lists (vibes, categories, etc.)
- Mutual friend access
- Friend map layers
- Save-from-friend workflow

---

## Planned Features

- 🗺️ Personal food map
- 📍 Manual pin creation
- 📂 Custom lists
- 👥 Mutual friends
- ⭐ Lightweight verification (multi-user confirmation)
- 🧮 Scoreboard & contribution stats
- ⚡ Realtime updates (Supabase Realtime)
- 📱 Progressive Web App (PWA)

---

## Tech Stack

### Frontend
- **React + TypeScript**
- **Vite**
- **TanStack Router**
- **TanStack Query**
- **Tailwind CSS**
- **Mapbox GL JS**

### Backend / Infra (Planned)
- **Supabase**
  - Auth
  - Postgres
  - Realtime
  - Storage
- **Cloudflare Pages**
- **Cloudflare Workers** (optional, later)

---

## Design System

**Theme:** Neon Verdant  
Dark, minimal, fast, and slightly glowing.

- Background: `#050807`
- Surface: `#0B1210`
- Primary accent: `#39FF88`
- Text: `#E9FFF2`
- Subtle neon glow (tight, premium — no RGB chaos)

Dark mode is the default. Light mode may be added later.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Mapbox account (free tier)
