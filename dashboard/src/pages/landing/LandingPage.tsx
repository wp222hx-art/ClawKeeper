// file: src/pages/landing/LandingPage.tsx
// description: IPOPilot landing page — bilingual (en/zh), financial-feel theme,
//              with a "paper-shake" / 纸片抖动 layer of fluttering S-1 / 招股书
//              cards drifting across the hero, plus a Three.js noise-distorted
//              point cloud and a scroll-driven 9-stage IPO lifecycle.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import {
  CircleDashed,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Globe2,
  Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// GLSL shaders for the noise-distorted point cloud
// ---------------------------------------------------------------------------
const vertexShader = `
  uniform float uTime;
  uniform float uDistortion;
  uniform float uSize;
  uniform vec2 uMouse;
  varying float vNoise;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod289(i);
      vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 1.0/7.0;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
      vec3 pos = position;
      float noise = snoise(vec3(pos.x * 0.5 + uTime * 0.15, pos.y * 0.5, pos.z * 0.5));
      vNoise = noise;
      vec3 newPos = pos + (normal * noise * uDistortion);
      float dist = distance(uMouse * 10.0, newPos.xy);
      float interaction = smoothstep(6.0, 0.0, dist);
      newPos.z += interaction * 1.5;
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = uSize * (20.0 / -mvPosition.z);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vNoise;
  void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.45) discard;
      float alpha = 1.0;
      vec3 color1 = uColor;
      // Financial gold tint at the second pole
      vec3 color2 = vec3(0.85, 0.65, 0.20);
      vec3 finalColor = mix(color1, color2, vNoise * 0.5 + 0.5);
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Static config: paper-shake layer & ticker tape
// ---------------------------------------------------------------------------
type PaperKind = { en: string; zh: string; sub: string };
const PAPER_KINDS: PaperKind[] = [
  { en: 'S-1',           zh: '招股书',     sub: 'SEC · DRAFT' },
  { en: 'F-1',           zh: '招股说明书', sub: 'SEC · F-1' },
  { en: 'HKEX A1',       zh: '上市申请',   sub: '港交所 · A1' },
  { en: 'Form 10-K',     zh: '年报',       sub: 'SEC · 10-K' },
  { en: 'DCF Model',     zh: 'DCF 估值',   sub: 'VAL · v3' },
  { en: 'Audit Memo',    zh: '审计备忘',   sub: 'BIG-4 · DRAFT' },
  { en: 'Comment Reply', zh: '问询回复',   sub: 'SEC · CL #02' },
  { en: 'Roadshow',      zh: '路演材料',   sub: 'ECM · v7' },
  { en: 'Lock-up Memo',  zh: '锁定期',     sub: 'POST · IPO' },
  { en: 'Sponsor Memo',  zh: '保荐报告',   sub: 'HKEX · SPONSOR' },
];

const TICKER_ROW = [
  { sym: 'IPOX',   px: '+18.42', up: true  },
  { sym: 'AAPL',   px: '+1.24',  up: true  },
  { sym: 'TSLA',   px: '-2.81',  up: false },
  { sym: 'NVDA',   px: '+3.96',  up: true  },
  { sym: '0700.HK',px: '+0.62',  up: true  },
  { sym: '9988.HK',px: '-0.45',  up: false },
  { sym: 'SPY',    px: '+0.18',  up: true  },
  { sym: 'IXIC',   px: '+0.44',  up: true  },
  { sym: 'HSI',    px: '-0.12',  up: false },
  { sym: 'DJIA',   px: '+0.07',  up: true  },
];

// 9 lifecycle stage keys
const LIFECYCLE_STAGES: Array<{
  k: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9';
  threshold: number;
  emphasis?: boolean;
}> = [
  { k: 's1', threshold: 0.05 },
  { k: 's2', threshold: 0.15 },
  { k: 's3', threshold: 0.25 },
  { k: 's4', threshold: 0.36 },
  { k: 's5', threshold: 0.47, emphasis: true },
  { k: 's6', threshold: 0.58 },
  { k: 's7', threshold: 0.69 },
  { k: 's8', threshold: 0.80 },
  { k: 's9', threshold: 0.90 },
];

export function LandingPage() {
  const navigate = useNavigate();
  const t = useT();
  const { locale, set_locale } = useLocale();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState('pro');

  // ----- Three.js scene -----
  useEffect(() => {
    if (!canvasRef.current) return;
    const mount = canvasRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xF5F5F7, 0.04);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    while (mount.firstChild) mount.removeChild(mount.firstChild);
    mount.appendChild(renderer.domElement);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const geometry = new THREE.BoxGeometry(9, 9, 9, 40, 40, 40);
    const uniforms = {
      uTime: { value: 0 },
      uDistortion: { value: 0.6 },
      uSize: { value: 1.8 },
      uColor: { value: new THREE.Color('#0F172A') },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      blending: THREE.NormalBlending,
    });

    const points = new THREE.Points(geometry, material);
    objectGroup.add(points);

    let time = 0;
    let mouseX = 0, mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      uniforms.uMouse.value.x += (mouseX - uniforms.uMouse.value.x) * 0.03;
      uniforms.uMouse.value.y += (mouseY - uniforms.uMouse.value.y) * 0.03;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      const w = window.innerWidth;
      if (w < 1024) {
        objectGroup.position.set(4, 5, -8);
        objectGroup.scale.set(0.65, 0.65, 0.65);
      } else {
        objectGroup.position.set(0, 2.5, 0);
        objectGroup.scale.set(0.65, 0.65, 0.65);
      }
    };

    const handleScroll = () => {
      const scrollY = window.scrollY;
      objectGroup.rotation.z = scrollY * 0.0005;
      const w = window.innerWidth;
      const baseY = w < 1024 ? 5 : 2.5;
      objectGroup.position.y = baseY + scrollY * 0.005;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    handleResize();

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      time += 0.008;
      objectGroup.rotation.y = time * 0.2;
      uniforms.uTime.value = time;
      camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
      camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // ----- Lifecycle scroll progression -----
  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById('decision-lifecycle');
      const header = document.getElementById('lifecycle-header');
      const line = document.getElementById('lifecycle-line');
      const steps = document.querySelectorAll('.lifecycle-step');

      if (!section || !header || !line) return;

      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const travelDistance = rect.height - viewH;
      const scrolled = -rect.top;
      let progress = scrolled / travelDistance;
      progress = Math.max(0, Math.min(1, progress));

      header.style.opacity = progress > 0.02 ? '1' : '0';
      (line as HTMLElement).style.height = (progress * 100) + '%';

      steps.forEach((step) => {
        const th = parseFloat((step as HTMLElement).dataset.threshold || '0');
        const el = step as HTMLElement;
        if (progress >= th) {
          if (progress < th + 0.10) {
            el.classList.add('active');
            el.classList.replace('opacity-30', 'opacity-100');
            el.style.transform = 'scale(1.04)';
          } else {
            el.classList.add('active');
            el.classList.replace('opacity-100', 'opacity-60');
            el.classList.replace('opacity-30', 'opacity-60');
            el.style.transform = 'scale(1)';
          }
        } else {
          el.classList.remove('active');
          el.classList.replace('opacity-100', 'opacity-30');
          el.classList.replace('opacity-60', 'opacity-30');
          el.style.transform = 'scale(1)';
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ----- Helpers -----
  const tk = (k: string) => t(k as TranslationKey);
  const paper_label = (p: PaperKind) => (locale === 'zh' ? p.zh : p.en);

  const testimonials = [0, 1, 2].map((i) => ({
    quote:  tk(`landing.testimonials.${i}.quote`),
    author: tk(`landing.testimonials.${i}.author`),
    role:   tk(`landing.testimonials.${i}.role`),
  }));
  const stats = [0, 1, 2].map((row) =>
    [0, 1, 2].map((col) => ({
      val: tk(`landing.stats.${row}.${col}.val`),
      lbl: tk(`landing.stats.${row}.${col}.lbl`),
    })),
  );

  return (
    <div className="w-full relative bg-canvas text-foreground font-sans overflow-x-hidden">
      {/* Inline stylesheet for paper-shake / ticker / hero-only flairs */}
      <style>{`
        @keyframes paper-flutter-a {
          0%   { transform: translate3d(0, 0, 0)       rotate(-6deg)  scale(1);    }
          25%  { transform: translate3d(14px, -22px, 0) rotate(2deg)   scale(1.02); }
          50%  { transform: translate3d(-8px, -42px, 0) rotate(-3deg)  scale(0.98); }
          75%  { transform: translate3d(18px, -18px, 0) rotate(5deg)   scale(1.03); }
          100% { transform: translate3d(0, 0, 0)       rotate(-6deg)  scale(1);    }
        }
        @keyframes paper-flutter-b {
          0%   { transform: translate3d(0, 0, 0)         rotate(7deg)  scale(1);    }
          33%  { transform: translate3d(-22px, -16px, 0) rotate(-4deg) scale(1.04); }
          66%  { transform: translate3d(10px, -36px, 0)  rotate(8deg)  scale(0.97); }
          100% { transform: translate3d(0, 0, 0)         rotate(7deg)  scale(1);    }
        }
        @keyframes paper-flutter-c {
          0%   { transform: translate3d(0, 0, 0)         rotate(-2deg) scale(1);    }
          50%  { transform: translate3d(6px, -28px, 0)   rotate(6deg)  scale(1.05); }
          100% { transform: translate3d(0, 0, 0)         rotate(-2deg) scale(1);    }
        }
        @keyframes paper-shred-shake {
          0%, 100% { transform: translate(0,0) rotate(var(--rot,0deg)); }
          10%      { transform: translate(-1px,  1px) rotate(calc(var(--rot,0deg) + 0.4deg)); }
          20%      { transform: translate( 1px, -1px) rotate(calc(var(--rot,0deg) - 0.5deg)); }
          30%      { transform: translate(-2px,  0)   rotate(calc(var(--rot,0deg) + 0.6deg)); }
          40%      { transform: translate( 2px,  1px) rotate(calc(var(--rot,0deg) - 0.7deg)); }
          50%      { transform: translate(-1px, -2px) rotate(calc(var(--rot,0deg) + 0.5deg)); }
          60%      { transform: translate( 2px,  0)   rotate(calc(var(--rot,0deg) - 0.4deg)); }
          70%      { transform: translate(-2px,  1px) rotate(calc(var(--rot,0deg) + 0.6deg)); }
          80%      { transform: translate( 1px, -2px) rotate(calc(var(--rot,0deg) - 0.6deg)); }
          90%      { transform: translate(-1px,  1px) rotate(calc(var(--rot,0deg) + 0.3deg)); }
        }
        .paper-card {
          --rot: 0deg;
          position: absolute;
          background: linear-gradient(180deg, #ffffff 0%, #f7f7f4 100%);
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 12px 28px -10px rgba(15, 23, 42, 0.18),
            0 2px 6px rgba(15, 23, 42, 0.08);
          border-radius: 4px;
          will-change: transform;
          backdrop-filter: blur(2px);
        }
        .paper-card::before {
          content: "";
          position: absolute; inset: 0;
          background:
            repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent 9px,
              rgba(15,23,42,0.05) 9px,
              rgba(15,23,42,0.05) 10px
            );
          pointer-events: none;
          border-radius: inherit;
          opacity: 0.7;
        }
        .paper-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(212,175,55,0.18), transparent 40%, rgba(15,23,42,0.05));
          pointer-events: none;
        }
        .paper-stamp {
          position: absolute;
          right: 8px; bottom: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px; font-weight: 700;
          color: rgba(212,90,30,0.85);
          border: 1.5px solid rgba(212,90,30,0.55);
          border-radius: 2px;
          padding: 1px 4px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transform: rotate(-12deg);
        }
        .paper-shred {
          animation: paper-shred-shake 1.6s ease-in-out infinite;
        }
        .ticker-track {
          display: inline-flex;
          gap: 2.5rem;
          animation: ticker-scroll 38s linear infinite;
          white-space: nowrap;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .gold-stroke {
          background: linear-gradient(90deg, #C8A24A 0%, #F2D27A 50%, #C8A24A 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .candle-up   { background: linear-gradient(180deg, #10b981 0%, #047857 100%); }
        .candle-down { background: linear-gradient(180deg, #f87171 0%, #b91c1c 100%); }
        .signal-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: signal-draw 4s ease-in-out infinite;
        }
        @keyframes signal-draw {
          0%   { stroke-dashoffset: 1000; }
          50%  { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -1000; }
        }
      `}</style>

      {/* Fixed Backgrounds */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, #00000007 1px, transparent 1px), linear-gradient(to bottom, #00000007 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div ref={canvasRef} className="fixed inset-0 z-0 opacity-100 pointer-events-none"></div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full px-6 py-5 md:px-12 flex justify-between items-center bg-canvas/85 backdrop-blur-md border-b border-border/50 transition-all duration-300">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-obsidian text-white flex items-center justify-center rounded-sm shadow-lg shadow-obsidian/20 ring-1 ring-amber-300/30">
            <CircleDashed className="w-3.5 h-3.5" />
          </div>
          <span className="font-sans text-sm font-bold tracking-tight text-obsidian">
            IPOPilot
          </span>
          <span className="hidden md:inline-block ml-1 text-[10px] font-mono uppercase tracking-widest text-subtle">
            {tk('brand.tagline')}
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#lifecycle" className="font-sans text-xs font-medium text-subtle hover:text-obsidian transition-colors">{tk('landing.nav.lifecycle')}</a>
          <a href="#features" className="font-sans text-xs font-medium text-subtle hover:text-obsidian transition-colors">{tk('landing.nav.product')}</a>
          <a href="#pricing"  className="font-sans text-xs font-medium text-subtle hover:text-obsidian transition-colors">{tk('landing.nav.pricing')}</a>
          <a href="#"         className="font-sans text-xs font-medium text-subtle hover:text-obsidian transition-colors">{tk('landing.nav.agents')}</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => set_locale(locale === 'zh' ? 'en' : 'zh')}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border/60 bg-white text-[11px] font-medium text-subtle hover:text-obsidian hover:border-obsidian/30 transition-colors"
            title={tk('common.language')}
          >
            <Languages className="w-3 h-3" />
            <span>{locale === 'zh' ? 'EN' : '中'}</span>
          </button>
          <button onClick={() => navigate('/login')} className="hidden md:block font-sans text-xs font-medium text-subtle hover:text-obsidian transition-colors">
            {tk('landing.nav.signin')}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="group relative isolate overflow-hidden bg-obsidian text-white text-xs font-semibold px-5 py-2.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-amber-300/25 transition-all duration-500 hover:scale-[1.04] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.25)] hover:ring-amber-300/45 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent z-10 pointer-events-none"></div>
            <span className="relative z-20">{tk('landing.nav.cta')}</span>
          </button>
        </div>
      </header>

      {/* Content Wrapper */}
      <div className="z-10 flex flex-col w-full relative">

        {/* HERO SECTION */}
        <section className="relative min-h-[92vh] flex flex-col lg:flex-row items-center justify-between px-6 md:px-12 lg:px-20 pt-32 pb-24 gap-16 overflow-hidden">

          {/* Paper-shake layer ----- the signature 纸片抖动 effect */}
          <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
            {PAPER_KINDS.map((p, i) => {
              const cycles  = ['paper-flutter-a', 'paper-flutter-b', 'paper-flutter-c'];
              const cycle   = cycles[i % cycles.length];
              const dur     = 7 + (i * 1.3) % 6;          // 7s..13s
              const delay   = -((i * 1.7) % 9);
              const top     = (8 + (i * 11) % 78);        // %
              const left    = (4 + (i * 17) % 88);        // %
              const rot     = ((i * 13) % 24) - 12;       // -12..+12 deg
              const w       = 110 + (i % 4) * 14;          // px
              const h       = 140 + (i % 3) * 18;          // px
              const opacity = 0.18 + (i % 5) * 0.06;       // 0.18..0.42
              const stamped = i % 3 === 0;
              return (
                <div
                  key={i}
                  className="paper-card"
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${w}px`,
                    height: `${h}px`,
                    opacity,
                    // @ts-expect-error CSS var
                    '--rot': `${rot}deg`,
                    transform: `rotate(${rot}deg)`,
                    animation: `${cycle} ${dur}s ease-in-out ${delay}s infinite`,
                  }}
                >
                  <div className="absolute inset-0 paper-shred flex flex-col p-2.5 gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] font-bold tracking-widest text-obsidian/70 uppercase">
                        {p.sub}
                      </span>
                      <span className="w-3 h-3 rounded-sm bg-obsidian/10"></span>
                    </div>
                    <div className="font-sans text-[13px] font-bold tracking-tight text-obsidian/80 leading-tight">
                      {paper_label(p)}
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="h-[3px] w-[88%] rounded bg-obsidian/15"></div>
                      <div className="h-[3px] w-[72%] rounded bg-obsidian/10"></div>
                      <div className="h-[3px] w-[60%] rounded bg-obsidian/10"></div>
                      <div className="h-[3px] w-[80%] rounded bg-obsidian/10"></div>
                      <div className="h-[3px] w-[55%] rounded bg-obsidian/10"></div>
                    </div>
                    {stamped && <div className="paper-stamp">DRAFT</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-w-2xl space-y-10 relative z-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-white border border-border/60 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-sans text-[11px] font-medium text-subtle tracking-tight">
                  {tk('landing.badge.live')}
                </span>
              </div>
              <h1 className="font-sans text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tighter text-obsidian leading-[0.95]">
                {tk('landing.hero.title.line1')}
                <br />
                <span className="gold-stroke">{tk('landing.hero.title.line2')}</span>
              </h1>
              <p className="max-w-md font-sans text-base text-subtle leading-relaxed">
                {tk('landing.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="group relative isolate overflow-hidden bg-obsidian text-white text-sm font-semibold px-8 py-3.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-amber-300/30 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] hover:ring-amber-300/55 active:scale-[0.98] flex items-center gap-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent z-0 pointer-events-none"></div>
                <span className="relative z-10">{tk('landing.hero.cta.primary')}</span>
                <ArrowRight className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => navigate('/help')}
                className="px-8 py-3.5 bg-white text-obsidian border border-border text-sm font-medium rounded shadow-sm transition-all duration-300 hover:bg-gray-50 hover:border-obsidian/40 hover:text-black hover:shadow-md active:scale-[0.97]"
              >
                {tk('landing.hero.cta.secondary')}
              </button>
            </div>
          </div>

          {/* Visual: live IPO Stage Gate card with mini candlestick + sparkline */}
          <div className="relative w-full max-w-lg aspect-square lg:aspect-[4/3] flex items-center justify-center z-10">
            <div className="absolute inset-0 bg-gradient-to-tr from-canvas via-white to-amber-50/40 opacity-60 blur-3xl"></div>
            <div className="w-full h-full p-6 relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-xl border border-border/60 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-400 via-obsidian to-amber-400"></div>
              <div className="h-full w-full flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-subtle">
                      {tk('landing.hero.card.title')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-subtle">{tk('landing.hero.card.stage')}</span>
                </div>

                {/* Three KPI rows */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-canvas/80 border border-border/60 rounded p-2">
                    <div className="text-[9px] uppercase tracking-wider text-subtle mb-1">{tk('landing.hero.card.metric1')}</div>
                    <div className="text-lg font-bold text-obsidian">87%</div>
                    <div className="h-1 bg-border/40 rounded mt-1.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: '87%' }}></div>
                    </div>
                  </div>
                  <div className="bg-canvas/80 border border-border/60 rounded p-2">
                    <div className="text-[9px] uppercase tracking-wider text-subtle mb-1">{tk('landing.hero.card.metric2')}</div>
                    <div className="text-lg font-bold text-obsidian">4</div>
                    <div className="flex gap-1 mt-1.5">
                      <span className="w-2 h-2 rounded-sm bg-amber-400"></span>
                      <span className="w-2 h-2 rounded-sm bg-amber-400"></span>
                      <span className="w-2 h-2 rounded-sm bg-amber-400"></span>
                      <span className="w-2 h-2 rounded-sm bg-amber-400"></span>
                    </div>
                  </div>
                  <div className="bg-canvas/80 border border-border/60 rounded p-2">
                    <div className="text-[9px] uppercase tracking-wider text-subtle mb-1">{tk('landing.hero.card.metric3')}</div>
                    <div className="text-lg font-bold text-obsidian">23/27</div>
                    <div className="flex items-center gap-1 mt-1.5 text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="text-[9px] font-mono">+85.1%</span>
                    </div>
                  </div>
                </div>

                {/* Mini candlestick row */}
                <div className="flex-1 relative bg-canvas/40 rounded border border-border/40 p-3 overflow-hidden">
                  <div className="absolute top-2 left-3 text-[9px] uppercase tracking-wider text-subtle">IPOX · 1Y</div>
                  <div className="absolute top-2 right-3 flex items-center gap-1 text-[10px] font-mono text-emerald-600">
                    <TrendingUp className="w-3 h-3" /> +18.42%
                  </div>
                  <div className="h-full pt-6 flex items-end justify-between gap-[3px]">
                    {Array.from({ length: 32 }).map((_, i) => {
                      const up = ((i * 7 + 3) % 5) > 1;
                      const h = 18 + ((i * 13 + 7) % 70);
                      return (
                        <div key={i} className="relative flex-1 flex items-end" style={{ height: '100%' }}>
                          <div
                            className={`w-full rounded-sm ${up ? 'candle-up' : 'candle-down'}`}
                            style={{ height: `${h}%`, minHeight: '6px', opacity: 0.85 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* Sparkline overlay */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                    <path
                      d="M0,55 L20,50 L40,52 L60,40 L80,42 L100,28 L120,34 L140,20 L160,22 L180,12 L200,16"
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="signal-path"
                    />
                  </svg>
                </div>

                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-obsidian text-white text-[10px] font-medium px-3 py-1.5 rounded shadow-xl ring-1 ring-amber-300/40 whitespace-nowrap">
                  {tk('landing.hero.card.confidence')}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER TAPE */}
        <section className="relative border-y border-border/60 bg-obsidian text-white overflow-hidden">
          <div className="py-3 overflow-hidden">
            <div className="ticker-track font-mono text-[12px]">
              {[...TICKER_ROW, ...TICKER_ROW].map((t2, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span className="text-amber-300 tracking-wider">{t2.sym}</span>
                  <span className={t2.up ? 'text-emerald-400' : 'text-rose-400'}>
                    {t2.up ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
                  </span>
                  <span className={t2.up ? 'text-emerald-300' : 'text-rose-300'}>{t2.px}%</span>
                  <span className="text-white/30">|</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* TRUSTED BY */}
        <section className="border-b border-border/60 py-14 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-10">
            <p className="text-xs font-semibold text-obsidian whitespace-nowrap md:w-auto w-full text-center md:text-left flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-amber-500" />
              {tk('landing.logos.label')}
            </p>
            <div className="flex flex-wrap justify-center md:justify-end gap-x-12 gap-y-6 opacity-70 hover:opacity-100 transition-opacity duration-500">
              <span className="font-sans text-lg font-bold text-obsidian tracking-tight">Nasdaq</span>
              <span className="font-sans text-lg font-bold text-obsidian tracking-tight">NYSE</span>
              <span className="font-sans text-lg font-bold text-obsidian tracking-tight">HKEX</span>
              <span className="font-sans text-lg font-bold text-obsidian tracking-tight">SEC</span>
              <span className="font-sans text-lg font-bold text-obsidian tracking-tight">Big-4</span>
            </div>
          </div>
        </section>

        {/* LIFECYCLE SECTION */}
        <section
          id="lifecycle"
          className="relative w-full bg-canvas border-b border-border/60"
        >
          <div id="decision-lifecycle" style={{ height: '500vh' }}>
            <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex flex-col items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#00000008_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
              <div className="max-w-4xl w-full px-6 md:px-12 relative z-10 flex flex-col items-center h-full py-16">
                <div className="text-center mb-8 shrink-0 opacity-0 transition-opacity duration-700" id="lifecycle-header">
                  <h2 className="font-sans text-2xl md:text-3xl font-semibold text-obsidian tracking-tight mb-3">
                    {tk('landing.lifecycle.title')}
                  </h2>
                  <p className="text-subtle text-sm max-w-md mx-auto">
                    {tk('landing.lifecycle.subtitle')}
                  </p>
                </div>
                <div className="relative w-full max-w-2xl flex-1 flex flex-col justify-center my-auto">
                  <div className="absolute left-1/2 top-4 bottom-4 w-px bg-border/60 -translate-x-1/2"></div>
                  <div id="lifecycle-line" className="absolute left-1/2 top-4 w-px bg-gradient-to-b from-amber-400 via-obsidian to-amber-400 -translate-x-1/2 transition-all duration-75 ease-linear h-0 max-h-[calc(100%-2rem)]"></div>
                  <div className="space-y-10 py-4 relative">
                    {LIFECYCLE_STAGES.map((s, idx) => {
                      const flip = idx % 2 === 1;
                      return (
                        <div
                          key={s.k}
                          className="lifecycle-step group flex items-center justify-between w-full opacity-30 transition-all duration-500"
                          data-threshold={s.threshold}
                        >
                          <div className={`w-[42%] ${flip ? 'order-3 pl-8' : 'text-right pr-8'}`}>
                            <span className="font-mono text-[10px] text-subtle uppercase tracking-wider block mb-1">
                              {tk(`landing.lifecycle.${s.k}.tag`)}
                            </span>
                            <h3 className="font-sans text-base font-semibold text-obsidian">
                              {tk(`landing.lifecycle.${s.k}.title`)}
                            </h3>
                            <p className="text-xs text-subtle mt-1 hidden md:block">
                              {tk(`landing.lifecycle.${s.k}.desc`)}
                            </p>
                          </div>
                          <div className="relative shrink-0 z-10 order-2">
                            <div className="w-3 h-3 rounded-full border border-border bg-canvas group-[.active]:border-amber-400 group-[.active]:bg-amber-400 group-[.active]:shadow-[0_0_0_4px_rgba(212,175,55,0.18)] transition-all duration-300"></div>
                          </div>
                          <div className={`w-[42%] ${flip ? 'order-1 text-right pr-8' : 'pl-8'}`}>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded ${s.emphasis ? 'bg-obsidian text-white shadow-lg shadow-obsidian/20 ring-1 ring-amber-300/40' : 'bg-white border border-border text-obsidian'} text-[11px] font-medium`}>
                              {s.emphasis && <FileText className="w-3 h-3" />}
                              <span>{tk(`landing.lifecycle.${s.k}.chip`)}</span>
                              {s.emphasis && <Check className="w-3 h-3" />}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="py-32 px-6 md:px-12 lg:px-20 bg-canvas">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <div className="max-w-xl">
                <div className="text-[11px] font-mono uppercase tracking-widest text-amber-600 mb-3">
                  {tk('landing.features.eyebrow')}
                </div>
                <h2 className="font-sans text-4xl md:text-5xl font-semibold text-obsidian tracking-tight mb-6 leading-[1.1]">
                  {tk('landing.features.title.a')}{' '}
                  <span className="gold-stroke">{tk('landing.features.title.b')}</span>
                </h2>
                <p className="text-subtle text-lg leading-relaxed">
                  {tk('landing.features.subtitle')}
                </p>
              </div>
              <button
                onClick={() => navigate('/agents')}
                className="pb-1 border-b border-obsidian text-sm font-medium hover:opacity-70 transition-opacity mb-2"
              >
                {tk('landing.features.cta')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Card 1: 82 specialised IPO agents */}
              <div className="md:col-span-8 group relative bg-white border border-border rounded-xl overflow-hidden hover:border-amber-400/60 transition-all duration-500">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div className="relative z-10 p-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="max-w-md">
                      <div className="w-10 h-10 bg-canvas border border-border rounded flex items-center justify-center mb-6 text-obsidian shadow-sm">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <h3 className="text-2xl font-semibold text-obsidian mb-3">{tk('landing.features.f1.title')}</h3>
                      <p className="text-subtle leading-relaxed">{tk('landing.features.f1.desc')}</p>
                    </div>
                    <div className="hidden lg:block">
                      <div className="px-3 py-1 bg-canvas border border-border rounded text-[10px] font-mono text-subtle uppercase tracking-wider group-hover:text-amber-600 group-hover:border-amber-400/60 transition-colors">
                        {tk('landing.features.f1.tag')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-12 grid grid-cols-12 gap-1.5 border-t border-border/40 pt-6">
                    {Array.from({ length: 82 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-3 rounded-sm border border-border/40"
                        style={{
                          background: i < 18 ? 'rgba(212,175,55,0.7)' : i < 40 ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.18)',
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: Sign-off gate */}
              <div className="md:col-span-4 group relative bg-white border border-border rounded-xl overflow-hidden hover:border-amber-400/60 transition-all duration-500 flex flex-col">
                <div className="p-10 relative z-10 flex flex-col h-full">
                  <div className="w-10 h-10 bg-canvas border border-border rounded flex items-center justify-center mb-6 text-obsidian shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-obsidian mb-3">{tk('landing.features.f2.title')}</h3>
                  <p className="text-sm text-subtle leading-relaxed mb-6">{tk('landing.features.f2.desc')}</p>
                  <div className="mt-auto space-y-2">
                    {['Lawyer', 'Auditor', 'CFO', 'Sponsor'].map((role, i) => (
                      <div key={role} className="flex items-center gap-2 px-3 py-2 bg-canvas border border-border rounded">
                        <div className={`w-2 h-2 rounded-full ${i < 3 ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></div>
                        <span className="text-xs font-medium text-obsidian flex-1">{role}</span>
                        <span className="text-[10px] font-mono text-subtle">{i < 3 ? '✓' : '…'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-[10px] font-mono text-amber-600 uppercase tracking-widest">
                    {tk('landing.features.f2.tag')}
                  </div>
                </div>
              </div>

              {/* Card 3: Cited prospectus drafting */}
              <div className="md:col-span-12 group relative bg-white border border-border rounded-xl overflow-hidden hover:border-amber-400/60 transition-all duration-500">
                <div className="p-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 max-w-lg">
                    <div className="w-10 h-10 bg-canvas border border-border rounded flex items-center justify-center mb-6 text-obsidian shadow-sm">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-obsidian mb-2">{tk('landing.features.f3.title')}</h3>
                    <p className="text-subtle leading-relaxed">{tk('landing.features.f3.desc')}</p>
                  </div>
                  <div className="flex-1 w-full grid grid-cols-2 gap-3">
                    {[
                      { tag: 'Reg S-K Item 303', body: 'MD&A trend analysis…' },
                      { tag: 'HKEX App.16',      body: 'Connected transactions…' },
                      { tag: 'SOX 404',          body: 'Internal control attestation…' },
                      { tag: 'IFRS 15',          body: 'Revenue recognition policy…' },
                    ].map((c, i) => (
                      <div key={i} className="bg-canvas border border-border rounded p-3 hover:border-amber-400/60 transition-colors">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-amber-600 mb-1">{c.tag}</div>
                        <div className="text-xs text-obsidian leading-relaxed">{c.body}</div>
                        <div className="mt-2 h-[2px] w-full bg-border/40 rounded">
                          <div className="h-full bg-amber-400/70 rounded" style={{ width: `${60 + i * 10}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-32 bg-obsidian text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
          <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="relative w-full h-[300px]">
                  {testimonials.map((tm, i) => (
                    <div
                      key={i}
                      className={`absolute inset-0 transition-all duration-700 ease-in-out flex flex-col justify-center ${
                        i === activeTestimonial ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                      }`}
                    >
                      <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter mb-8 leading-snug">"{tm.quote}"</h2>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-400/20 ring-1 ring-amber-300/40 flex items-center justify-center font-bold text-lg text-amber-200">
                          {tm.author[0]}
                        </div>
                        <div>
                          <div className="font-medium text-white">{tm.author}</div>
                          <div className="text-sm text-white/50">{tm.role}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-10">
                  <button
                    onClick={() => setActiveTestimonial(prev => Math.max(0, prev - 1))}
                    disabled={activeTestimonial === 0}
                    className="group w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTestimonial(prev => Math.min(testimonials.length - 1, prev + 1))}
                    disabled={activeTestimonial === testimonials.length - 1}
                    className="group w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-row md:flex-col justify-between gap-6 md:gap-0 md:space-y-12 border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0 md:pl-16">
                {stats[activeTestimonial].map((stat, i) => (
                  <div key={i}>
                    <div className="text-3xl md:text-4xl font-bold mb-1 gold-stroke">{stat.val}</div>
                    <div className="text-sm text-white/50">{stat.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-32 px-6 md:px-12 lg:px-20 border-b border-border bg-canvas">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-sans text-3xl md:text-4xl font-semibold text-obsidian tracking-tight mb-4">
                {tk('landing.pricing.title')}
              </h2>
              <p className="text-subtle text-base">{tk('landing.pricing.subtitle')}</p>

              <div className="mt-8 flex items-center justify-center gap-3">
                <span className={`text-sm ${pricingPeriod === 'monthly' ? 'text-obsidian font-medium' : 'text-subtle'}`}>
                  {tk('landing.pricing.monthly')}
                </span>
                <button
                  onClick={() => setPricingPeriod(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                  className="w-12 h-6 rounded-full bg-border relative transition-colors duration-300 focus:outline-none"
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${pricingPeriod === 'yearly' ? 'left-7' : 'left-1'}`}></div>
                </button>
                <span className={`text-sm ${pricingPeriod === 'yearly' ? 'text-obsidian font-medium' : 'text-subtle'}`}>
                  {tk('landing.pricing.yearly')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Single Deal */}
              <div
                className={`group relative p-8 rounded-xl border flex flex-col cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'starter'
                    ? 'bg-white border-obsidian shadow-xl scale-[1.02] z-10'
                    : 'bg-white border-border hover:border-amber-400/60 hover:-translate-y-1'
                }`}
                onClick={() => setSelectedPlan('starter')}
              >
                <div className="mb-4"><span className="font-semibold text-obsidian">{tk('landing.pricing.starter.name')}</span></div>
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-obsidian">
                    {pricingPeriod === 'monthly' ? tk('landing.pricing.starter.price.m') : tk('landing.pricing.starter.price.y')}
                  </span>
                  <span className="text-sm text-subtle">{tk('landing.pricing.starter.unit')}</span>
                </div>
                <p className="text-sm text-subtle mb-8 leading-relaxed">{tk('landing.pricing.starter.desc')}</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.starter.f1')}</li>
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.starter.f2')}</li>
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.starter.f3')}</li>
                </ul>
                <Button variant="outline" className="w-full">{tk('landing.pricing.starter.cta')}</Button>
              </div>

              {/* ECM Desk */}
              <div
                className={`group relative p-8 rounded-xl flex flex-col cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'pro'
                    ? 'bg-obsidian text-white shadow-xl scale-[1.02] z-10 ring-1 ring-amber-300/40'
                    : 'bg-white border border-border hover:border-amber-400/60 hover:-translate-y-1'
                }`}
                onClick={() => setSelectedPlan('pro')}
              >
                <div className="mb-4"><span className="font-semibold">{tk('landing.pricing.pro.name')}</span></div>
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">
                    {pricingPeriod === 'monthly' ? tk('landing.pricing.pro.price.m') : tk('landing.pricing.pro.price.y')}
                  </span>
                  <span className="text-sm opacity-80">{tk('landing.pricing.pro.unit')}</span>
                </div>
                <p className="text-sm opacity-60 mb-8 leading-relaxed">{tk('landing.pricing.pro.desc')}</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex gap-3 text-sm opacity-80"><Check className="w-4 h-4 shrink-0" />{tk('landing.pricing.pro.f1')}</li>
                  <li className="flex gap-3 text-sm opacity-80"><Check className="w-4 h-4 shrink-0" />{tk('landing.pricing.pro.f2')}</li>
                  <li className="flex gap-3 text-sm opacity-80"><Check className="w-4 h-4 shrink-0" />{tk('landing.pricing.pro.f3')}</li>
                </ul>
                <Button className="w-full bg-white text-obsidian hover:bg-gray-100">{tk('landing.pricing.pro.cta')}</Button>
              </div>

              {/* Bulge Bracket */}
              <div
                className={`group relative p-8 rounded-xl border flex flex-col cursor-pointer transition-all duration-300 ${
                  selectedPlan === 'enterprise'
                    ? 'bg-white border-obsidian shadow-xl scale-[1.02] z-10'
                    : 'bg-white border-border hover:border-amber-400/60 hover:-translate-y-1'
                }`}
                onClick={() => setSelectedPlan('enterprise')}
              >
                <div className="mb-4"><span className="font-semibold text-obsidian">{tk('landing.pricing.ent.name')}</span></div>
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-obsidian">{tk('landing.pricing.ent.price')}</span>
                </div>
                <p className="text-sm text-subtle mb-8 leading-relaxed">{tk('landing.pricing.ent.desc')}</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.ent.f1')}</li>
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.ent.f2')}</li>
                  <li className="flex gap-3 text-sm text-subtle"><Check className="w-4 h-4 text-obsidian shrink-0" />{tk('landing.pricing.ent.f3')}</li>
                </ul>
                <Button variant="outline" className="w-full">{tk('landing.pricing.ent.cta')}</Button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-white py-20 px-6 md:px-12 lg:px-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
            <div className="max-w-xs space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-obsidian rounded-sm flex items-center justify-center ring-1 ring-amber-300/30">
                  <CircleDashed className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold text-sm tracking-tight text-obsidian">IPOPilot</span>
              </div>
              <p className="text-xs text-subtle leading-relaxed">
                {tk('landing.footer.tagline')}
              </p>
              <div className="text-[10px] text-border">{tk('landing.footer.copyright')}</div>
            </div>

            <div className="flex gap-16">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-obsidian">{tk('landing.footer.col1')}</h4>
                <ul className="space-y-2 text-xs text-subtle">
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col1.0')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col1.1')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col1.2')}</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-obsidian">{tk('landing.footer.col2')}</h4>
                <ul className="space-y-2 text-xs text-subtle">
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col2.0')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col2.1')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col2.2')}</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-obsidian">{tk('landing.footer.col3')}</h4>
                <ul className="space-y-2 text-xs text-subtle">
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col3.0')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col3.1')}</a></li>
                  <li><a href="#" className="hover:text-obsidian">{tk('landing.footer.col3.2')}</a></li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
