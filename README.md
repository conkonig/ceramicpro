# Ceramic Pro NZ — Static Marketing Site

A static, multi-page marketing site for Ceramic Pro New Zealand. Hosted on GitHub Pages.

## Pages
- `index.html` — Home with full-bleed video hero (car-driving.mp4)
- `about.html` — Mission, stats, benefits
- `automotive.html` — Automotive surface protection
- `marine.html` — Marine protection + FAQ
- `contact.html` — Quote form + installer partnership

## Stack
- Static HTML
- Tailwind CSS (via CDN, no build step)
- Hanken Grotesk / Inter / JetBrains Mono (Google Fonts)
- Material Symbols (Google Fonts) for icons
- Plain JS for nav toggle, scroll reveals and FAQ accordions

## Assets
- `assets/car-driving.mp4` — hero video used on home, about, automotive
- `assets/high-res-car.png` — poster + content imagery
- `assets/site.css` — shared design tokens, glass cards, reveal animations
- `assets/site.js` — nav, reveal observer, FAQ, smooth scroll

## Local preview
```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy
Pushed to GitHub Pages on the `main` branch.
