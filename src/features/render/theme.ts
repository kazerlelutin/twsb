import { FONT_STACKS, fontFaces, type Identity } from "../site/site.type";
import { color } from "./html";

const font = (key: string) =>
  FONT_STACKS[key]?.stack ?? FONT_STACKS.system.stack;

export function themeCss(identity: Identity) {
  const c = identity.colors;
  return `${fontFaces([identity.fonts.heading, identity.fonts.body])}:root{--ws-primary:${color(c.primary) || "#237ab3"};--ws-secondary:${color(c.secondary) || "#152438"};--ws-text:${color(c.text) || "#101c2c"};--ws-bg:${color(c.background) || "#fff"};--ws-surface:${color(c.surface) || "#f4f9fd"};--ws-muted:${color(c.muted) || "#51637a"};--ws-font-heading:${font(identity.fonts.heading)};--ws-font-body:${font(identity.fonts.body)};--ws-radius:${Number(identity.radius) || 0}px;--ws-width:${Number(identity.width) || 1180}px}`;
}

/** Préchargement des polices embarquées utilisées par le thème. */
export const fontPreloads = (identity: Identity) =>
  [...new Set([identity.fonts.heading, identity.fonts.body])]
    .map((key) => FONT_STACKS[key]?.file)
    .filter(Boolean)
    .map(
      (file) =>
        `<link rel="preload" href="/fonts/${file}.woff2" as="font" type="font/woff2" crossorigin>`,
    )
    .join("");

/** Feuille de base du site public : légère, sans dépendance. */
export const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ws-bg);color:var(--ws-text);font-family:var(--ws-font-body);font-size:1.0625rem;line-height:1.65}
h1,h2,h3,h4{font-family:var(--ws-font-heading);line-height:1.2;margin:0 0 .6em}
h1{font-size:clamp(2rem,5vw,3.25rem)}h2{font-size:clamp(1.6rem,3.5vw,2.4rem)}h3{font-size:1.4rem}h4{font-size:1.15rem}
p{margin:0 0 1em}a{color:var(--ws-primary)}img{max-width:100%;height:auto;display:block}
:focus-visible{outline:2px solid var(--ws-primary);outline-offset:2px}
.ws-skip{position:absolute;left:-999px;top:0;z-index:100;padding:.6rem 1rem;background:var(--ws-bg)}.ws-skip:focus{left:1rem}
.ws-container{width:min(100% - 2.5rem,var(--ws-width));margin-inline:auto}
.ws-container--wide{width:min(100% - 2.5rem,calc(var(--ws-width) + 320px))}.ws-container--full{width:100%}
.ws-block{position:relative}
.ws-section{position:relative;padding-block:clamp(2.5rem,6vw,5rem);background-size:cover;background-position:center}
.ws-section>.ws-overlay{position:absolute;inset:0;background:#000;pointer-events:none}
.ws-section>.ws-container{position:relative}
.ws-columns{display:grid;gap:var(--gap,32px);align-items:var(--valign,start)}
.ws-columns>.ws-block{min-width:0}.ws-column{min-width:0;height:100%;display:flex;flex-direction:column;gap:1rem}
.ws-column>.ws-block,.ws-section>.ws-container>.ws-block+.ws-block{margin-top:0}
.ws-section>.ws-container{display:flex;flex-direction:column;gap:1.25rem}
.ws-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.7rem 1.3rem;border:2px solid var(--ws-primary);border-radius:var(--ws-radius);background:var(--ws-primary);color:#fff;font-weight:600;text-decoration:none;line-height:1.2;transition:filter .15s}
.ws-btn:hover{filter:brightness(1.1)}.ws-btn--outline{background:transparent;color:var(--ws-primary)}.ws-btn--link{background:none;border-color:transparent;color:var(--ws-primary);padding-inline:0;text-decoration:underline}
.ws-btn--sm{padding:.45rem .9rem;font-size:.9rem}.ws-btn--lg{padding:.95rem 1.8rem;font-size:1.15rem}
.ws-actions{display:flex;flex-wrap:wrap;gap:.75rem}
.ws-figure{margin:0}.ws-figure figcaption{margin-top:.5rem;color:var(--ws-muted);font-size:.9rem}
.ws-figure img,.ws-gallery img,.ws-card img{border-radius:var(--ws-radius)}
.ws-fit img{width:100%;height:100%;object-fit:cover}
.ws-grid{display:grid;gap:var(--gap,24px);grid-template-columns:repeat(var(--cols,3),minmax(0,1fr))}
.ws-card{display:flex;flex-direction:column;gap:.6rem;padding:1.25rem;border-radius:var(--ws-radius);background:var(--ws-surface);color:inherit;text-decoration:none;min-width:0}
a.ws-card:hover h3{color:var(--ws-primary)}.ws-card h3{margin:0;font-size:1.2rem}.ws-card p{margin:0;color:var(--ws-muted)}
.ws-card__media{margin:-1.25rem -1.25rem .4rem;aspect-ratio:16/10;overflow:hidden;border-radius:var(--ws-radius) var(--ws-radius) 0 0}
.ws-card__media img{width:100%;height:100%;object-fit:cover;border-radius:0}
.ws-feature__icon{font-size:1.6rem;color:var(--ws-primary);line-height:1}
.ws-hero{display:grid;gap:2.5rem;align-items:center}.ws-hero--split{grid-template-columns:1fr 1fr}.ws-hero--split-left{grid-template-columns:1fr 1fr}.ws-hero--split-left .ws-hero__media{order:-1}
.ws-hero--center{text-align:center;justify-items:center}.ws-hero--center .ws-actions{justify-content:center}
.ws-hero__eyebrow{color:var(--ws-primary);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.85rem;margin-bottom:.75rem}
.ws-hero__text{font-size:1.2rem;color:var(--ws-muted);max-width:42rem}
.ws-hero--background{position:relative;min-height:60vh;padding:3rem;border-radius:var(--ws-radius);overflow:hidden;color:#fff;align-content:center}
.ws-hero--background .ws-hero__media{position:absolute;inset:0;z-index:0}.ws-hero--background .ws-hero__media img{width:100%;height:100%;object-fit:cover;border-radius:0}
.ws-hero--background .ws-hero__media::after{content:"";position:absolute;inset:0;background:rgb(0 0 0/.45)}
.ws-hero--background .ws-hero__body{position:relative}.ws-hero--background .ws-hero__text{color:inherit}
.ws-quote{margin:0;padding-left:1.25rem;border-left:4px solid var(--ws-primary);font-size:1.25rem}.ws-quote footer{margin-top:.5rem;font-size:.95rem;color:var(--ws-muted)}
.ws-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:1.5rem;text-align:center}
.ws-stat__value{display:block;font-family:var(--ws-font-heading);font-size:2.5rem;font-weight:800;color:var(--ws-primary);line-height:1.1}
.ws-stat__label{color:var(--ws-muted)}
.ws-testimonial{margin:0;padding:1.5rem;border-radius:var(--ws-radius);background:var(--ws-surface)}.ws-testimonial figcaption{display:flex;gap:.75rem;align-items:center;margin-top:1rem}
.ws-testimonial img{width:44px;height:44px;border-radius:50%;object-fit:cover}
.ws-faq details{border-bottom:1px solid color-mix(in srgb,var(--ws-text) 15%,transparent);padding:1rem 0}.ws-faq summary{cursor:pointer;font-weight:600;font-size:1.1rem}.ws-faq details p{margin:.75rem 0 0}
.ws-cta{padding:clamp(2rem,5vw,3.5rem);border-radius:var(--ws-radius);background:var(--ws-secondary);color:#fff;text-align:center}.ws-cta p{opacity:.85}
.ws-contact{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));font-style:normal}.ws-contact strong{display:block;color:var(--ws-muted);font-size:.85rem;text-transform:uppercase;letter-spacing:.06em}
.ws-embed iframe,.ws-video iframe,.ws-video video{width:100%;aspect-ratio:16/9;border:0;border-radius:var(--ws-radius);display:block}
.ws-map iframe{width:100%;border:0;border-radius:var(--ws-radius);display:block}
.ws-social{display:flex;flex-wrap:wrap;gap:.5rem 1rem;list-style:none;margin:0;padding:0}
.ws-divider{border:0;border-top:var(--t,1px) solid var(--c,color-mix(in srgb,var(--ws-text) 15%,transparent));width:var(--w,100%);margin:0 auto}
.ws-logo{display:inline-flex;align-items:center;gap:.6rem;color:inherit;text-decoration:none;font-family:var(--ws-font-heading);font-weight:800;font-size:1.25rem}.ws-logo img{width:auto}
.ws-menu{display:flex;align-items:center}.ws-menu ul{list-style:none;margin:0;padding:0}
.ws-menu__list{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;align-items:center}
.ws-menu a{color:inherit;text-decoration:none;font-weight:500;display:block;padding:.4rem 0}.ws-menu a:hover,.ws-menu a[aria-current=page]{color:var(--ws-primary)}
.ws-menu li{position:relative}.ws-menu__sub{display:none;position:absolute;top:100%;left:-.75rem;min-width:12rem;padding:.5rem .75rem;background:var(--ws-bg);border-radius:var(--ws-radius);box-shadow:0 10px 30px rgb(0 0 0/.12);z-index:30}
.ws-menu li:hover>.ws-menu__sub,.ws-menu li:focus-within>.ws-menu__sub{display:block}
.ws-menu--pills .ws-menu__list>li>a{padding:.4rem .9rem;border-radius:999px}.ws-menu--pills .ws-menu__list>li>a:hover,.ws-menu--pills a[aria-current=page]{background:var(--ws-surface)}
.ws-menu--underline .ws-menu__list>li>a{border-bottom:2px solid transparent}.ws-menu--underline a[aria-current=page],.ws-menu--underline .ws-menu__list>li>a:hover{border-color:var(--ws-primary)}
.ws-menu--vertical .ws-menu__list{flex-direction:column;align-items:flex-start;gap:0}.ws-menu--vertical .ws-menu__sub{position:static;display:block;box-shadow:none;padding:0 0 0 1rem;background:none}
.ws-menu__toggle{display:none;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:var(--ws-radius);background:transparent;color:inherit;cursor:pointer}
.ws-menu__toggle svg{width:22px;height:22px}
.ws-menu--burger .ws-menu__toggle{display:inline-flex}
.js .ws-menu--burger .ws-menu__list{display:none}
.js .ws-menu--burger.is-open .ws-menu__list{display:flex;flex-direction:column;align-items:stretch;position:absolute;top:100%;right:0;left:0;padding:1rem 1.25rem;background:var(--ws-bg);box-shadow:0 10px 30px rgb(0 0 0/.12);z-index:40}
.ws-menu--burger{position:static}.ws-menu--burger .ws-menu__sub{position:static;display:block;box-shadow:none;padding:0 0 0 1rem}
.ws-header{position:relative;z-index:20;background:var(--ws-bg)}.ws-header--sticky{position:sticky;top:0}
.ws-header>.ws-block,.ws-footer>.ws-block{margin:0}
.ws-header .ws-section,.ws-footer .ws-section{position:relative;padding-block:1rem}
.ws-footer{margin-top:auto}
.ws-site{min-height:100svh;display:flex;flex-direction:column}
.ws-main{flex:1}
.ws-prose{max-width:46rem}.ws-prose img{border-radius:var(--ws-radius);margin:1.5rem 0}.ws-prose blockquote{margin:1.5rem 0;padding-left:1rem;border-left:4px solid var(--ws-primary);color:var(--ws-muted)}
.ws-prose pre{background:var(--ws-secondary);color:#fff;padding:1rem;border-radius:var(--ws-radius);overflow:auto}.ws-prose ul[data-type=taskList]{list-style:none;padding-left:0}.ws-prose ul[data-type=taskList] li{display:flex;gap:.5rem}
.ws-meta{color:inherit;opacity:.8;font-size:.95rem}
.ws-columns--d-reverse{direction:rtl}.ws-columns--d-reverse>*{direction:ltr}
.ws-tags{display:flex;flex-wrap:wrap;gap:.4rem;margin:0}.ws-tag{display:inline-block;padding:.15rem .65rem;border-radius:999px;background:var(--ws-surface);color:inherit;font-size:.85rem;text-decoration:none}.ws-tag:hover{color:var(--ws-primary)}
.ws-meta-row{display:grid;gap:.5rem;margin-bottom:1rem}.ws-meta-row .ws-meta{margin:0}
.ws-field__label{margin:0 0 .25rem;color:var(--ws-muted);font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.ws-swatch{display:inline-block;width:1em;height:1em;border-radius:.2em;vertical-align:middle}
.ws-post{display:flex;gap:1rem;padding:1rem 0;border-bottom:1px solid color-mix(in srgb,var(--ws-text) 12%,transparent);color:inherit;text-decoration:none}
.ws-post__media{flex:0 0 160px;aspect-ratio:4/3;overflow:hidden;border-radius:var(--ws-radius)}.ws-post__media img{width:100%;height:100%;object-fit:cover}
.ws-post h3{margin:0 0 .25rem}.ws-post p{margin:0;color:var(--ws-muted)}
.ws-empty{padding:2rem;text-align:center;color:var(--ws-muted);border:1px dashed color-mix(in srgb,var(--ws-text) 25%,transparent);border-radius:var(--ws-radius)}
@media (max-width:768px){
.ws-columns--m-stack{grid-template-columns:1fr!important;direction:ltr}.ws-columns--m-stack-reverse{display:flex;flex-direction:column-reverse;direction:ltr}
.ws-grid{grid-template-columns:repeat(min(var(--cols,3),var(--cols-m,1)),minmax(0,1fr))}
.ws-hero--split,.ws-hero--split-left{grid-template-columns:1fr}.ws-hero--background{padding:2rem 1.25rem}
.ws-menu--horizontal .ws-menu__toggle,.ws-menu--pills .ws-menu__toggle,.ws-menu--underline .ws-menu__toggle{display:inline-flex}
.js .ws-menu--horizontal .ws-menu__list,.js .ws-menu--pills .ws-menu__list,.js .ws-menu--underline .ws-menu__list{display:none}
.js .ws-menu.is-open .ws-menu__list{display:flex;flex-direction:column;align-items:stretch;position:absolute;top:100%;right:0;left:0;padding:1rem 1.25rem;background:var(--ws-bg);box-shadow:0 10px 30px rgb(0 0 0/.12);z-index:40}
.ws-menu .ws-menu__sub{position:static;display:block;box-shadow:none;padding:0 0 0 1rem}
.ws-menu{position:static}.ws-header .ws-section>.ws-container{position:static}
.ws-post{flex-direction:column}.ws-post__media{flex-basis:auto}
}
.ws-prose [data-youtube-video]{margin:1.5em 0}.ws-prose [data-youtube-video] iframe,.ws-prose iframe{display:block;width:100%;height:auto;aspect-ratio:16/9;border:0;border-radius:var(--ws-radius)}
.ws-link-card{display:flex;margin:1em 0;border:1px solid color-mix(in srgb,var(--ws-text) 14%,transparent);border-radius:var(--ws-radius);color:inherit;text-decoration:none;overflow:hidden;background:var(--ws-bg);transition:border-color .15s}
.ws-link-card:hover{border-color:var(--ws-primary)}
.ws-link-card__body{display:flex;flex-direction:column;gap:.25rem;padding:.85rem 1rem;min-width:0}
.ws-link-card__title{font-weight:600;line-height:1.3;color:var(--ws-text)}
.ws-link-card__desc{color:var(--ws-muted);font-size:.92rem;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ws-link-card__site{color:var(--ws-muted);font-size:.8rem}
.ws-link-card--inline{display:inline-flex;max-width:100%}.ws-link-card--inline .ws-link-card__body{flex-direction:row;align-items:baseline;gap:.6rem;padding:.45rem .8rem}
.ws-link-card--card .ws-link-card__img{width:min(34%,220px);flex:none;object-fit:cover;border-radius:0;margin:0}
.ws-prose .ws-link-card__img{margin:0;border-radius:0}
.ws-langs ul{display:flex;flex-wrap:wrap;gap:.35rem;list-style:none;margin:0;padding:0}
.ws-langs a{display:block;padding:.25rem .55rem;border-radius:var(--ws-radius);color:inherit;text-decoration:none;font-size:.9rem;font-weight:600}
.ws-langs a:hover{color:var(--ws-primary)}.ws-langs a[aria-current]{background:var(--ws-surface);color:var(--ws-primary)}
@media (max-width:560px){.ws-link-card--card{flex-direction:column}.ws-link-card--card .ws-link-card__img{width:100%;aspect-ratio:1.91/1}}
.ws-entries{display:grid;gap:var(--gap,24px)}.ws-entries--list{grid-template-columns:1fr}
.ws-entry{position:relative;display:flex;flex-direction:column;gap:.6rem;min-width:0}
.ws-entry--card{padding:1.1rem;border-radius:var(--ws-radius);background:var(--ws-surface)}
.ws-entry--card .wsb-content-cover:first-child{margin:-1.1rem -1.1rem .2rem}.ws-entry--card .wsb-content-cover:first-child>div{border-radius:var(--ws-radius) var(--ws-radius) 0 0!important;overflow:hidden}
.ws-entry .ws-fit img,.ws-entry img{width:100%;object-fit:cover}
.ws-entry__title{margin:0;font-size:1.25rem}.ws-entry__title a{color:inherit;text-decoration:none}
.ws-entry__title a::after{content:"";position:absolute;inset:0;border-radius:var(--ws-radius)}
.ws-entry:hover .ws-entry__title a{color:var(--ws-primary)}.ws-entry__title a:focus-visible{outline:none}.ws-entry:has(.ws-entry__title a:focus-visible){outline:2px solid var(--ws-primary);outline-offset:2px}
.ws-entry .ws-tags a,.ws-entry .ws-field a{position:relative;z-index:1}
.ws-entry .ws-meta-row,.ws-entry p{margin:0}.ws-excerpt{color:var(--ws-muted)}

.ws-entries__empty{color:var(--ws-muted)}
.ws-pagination{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem;margin-top:2rem}
.ws-pagination a{min-width:2.4rem;padding:.45rem .75rem;border-radius:var(--ws-radius);background:var(--ws-surface);color:inherit;text-align:center;text-decoration:none;font-weight:600}
.ws-pagination a:hover{color:var(--ws-primary)}.ws-pagination a[aria-current]{background:var(--ws-primary);color:#fff}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}`;

/** Script unique du site public : bascule des menus mobiles. */
export const SITE_SCRIPT = `document.documentElement.classList.add("js");document.addEventListener("click",function(e){var b=e.target.closest("[data-ws-toggle]");document.querySelectorAll(".ws-menu.is-open").forEach(function(m){if(!b||!m.contains(b)){m.classList.remove("is-open");var t=m.querySelector("[data-ws-toggle]");t&&t.setAttribute("aria-expanded","false")}});if(b){var m=b.closest(".ws-menu"),o=m.classList.toggle("is-open");b.setAttribute("aria-expanded",String(o))}});document.addEventListener("keydown",function(e){if(e.key==="Escape"){var m=document.querySelector(".ws-menu.is-open");if(m){m.classList.remove("is-open");var t=m.querySelector("[data-ws-toggle]");t.setAttribute("aria-expanded","false");t.focus()}}});`;
