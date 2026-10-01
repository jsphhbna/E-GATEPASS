import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LANDING_CONTENT } from '@/content/landing';
import { 
  ArrowRight, 
  QrCode, 
  UserCheck, 
  ShieldCheck, 
  UserX,
  ScanLine,
  CheckCircle,
  Smartphone,
  IdCard,
  Clock,
  Shield,
  FileCheck,
  ChevronDown
} from 'lucide-react';

export function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.querySelector(id);
    if (element) {
      const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ 
        behavior: isReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      // Update URL hash for accessibility/sharing without jumping
      window.history.pushState(null, '', id);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col" style={{ color: 'var(--color-earist-ink)', backgroundColor: '#fff' }}>
      
      {/* 4.1 Header (sticky) */}
      <header 
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-white shadow-sm' : 'bg-white/90 backdrop-blur-sm'}`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/earist-logo.png" alt="EARIST seal" className="h-10 w-10 object-contain" />
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-none tracking-tight">{LANDING_CONTENT.header.title}</span>
              <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{LANDING_CONTENT.header.subtitle}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6">
              {LANDING_CONTENT.header.navLinks.map((link) => (
                <a 
                  key={link.href} 
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-sm font-semibold hover:text-[#E60000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E60000] rounded-sm px-1 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <Link
              to="/get-pass"
              className="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-bold text-white transition-transform active:scale-95"
              style={{ backgroundColor: 'var(--color-earist-red)' }}
            >
              {LANDING_CONTENT.header.cta}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 4.2 Hero */}
        <section className="relative overflow-hidden px-4 py-16 md:py-24" style={{ backgroundColor: 'var(--color-earist-maroon)' }}>
          {/* Subtle background decoration */}
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <QrCode className="w-[120%] h-[120%] text-white" strokeWidth={0.5} />
          </div>
          
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <p className="mb-4 text-xs md:text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--color-earist-gold)' }}>
              {LANDING_CONTENT.hero.eyebrow}
            </p>
            <h1 className="mb-6 text-4xl md:text-6xl font-extrabold tracking-tight text-white">
              {LANDING_CONTENT.hero.title}
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg md:text-xl font-medium text-gray-200">
              {LANDING_CONTENT.hero.subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/get-pass"
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg px-8 py-4 text-[18.66px] font-bold text-white shadow-lg transition-transform active:scale-95 hover:brightness-110"
                style={{ backgroundColor: 'var(--color-earist-red)' }}
              >
                {LANDING_CONTENT.hero.ctaPrimary}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a
                href="#how-it-works"
                onClick={(e) => scrollToSection(e, '#how-it-works')}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg px-8 py-4 text-[18.66px] font-bold text-white border-2 border-white/20 transition-colors hover:bg-white/10"
              >
                {LANDING_CONTENT.hero.ctaSecondary}
              </a>
            </div>
            
            <p className="mt-6 text-sm font-medium text-gray-300">
              {LANDING_CONTENT.hero.features}
            </p>
          </div>
        </section>

        {/* 4.3 What is E-GatePass? */}
        <section id="what-is-it" className="scroll-mt-20 px-4 py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-3xl">
              <h2 className="mb-6 text-3xl md:text-4xl font-bold">{LANDING_CONTENT.whatIsIt.heading}</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                {LANDING_CONTENT.whatIsIt.description}
              </p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {LANDING_CONTENT.whatIsIt.cards.map((card, i) => {
                const icons = [<UserX className="h-6 w-6" />, <QrCode className="h-6 w-6" />, <UserCheck className="h-6 w-6" />, <ShieldCheck className="h-6 w-6" />];
                return (
                  <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg p-3" style={{ backgroundColor: 'var(--color-earist-red)', color: 'white' }}>
                      {icons[i]}
                    </div>
                    <h3 className="mb-2 text-lg font-bold">{card.title}</h3>
                    <p className="text-sm text-gray-600">{card.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4.4 How it works */}
        <section id="how-it-works" className="scroll-mt-20 px-4 py-16 md:py-24" style={{ backgroundColor: 'var(--color-canvas)' }}>
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-center text-3xl md:text-4xl font-bold">{LANDING_CONTENT.howItWorks.heading}</h2>
            
            {/* Desktop Stepper / Mobile Timeline */}
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 bg-gray-200"></div>
              
              <div className="flex flex-col md:flex-row gap-8 md:gap-4 relative z-10">
                {LANDING_CONTENT.howItWorks.steps.map((step, i) => {
                  return (
                    <div key={i} className="flex-1 flex flex-row md:flex-col items-start md:items-center relative group">
                      <div className="hidden md:block absolute top-12 left-1/2 -translate-x-1/2 w-max px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 mb-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        {step.group}
                      </div>
                      <div className="md:hidden flex-shrink-0 w-24 pt-3 text-xs font-bold text-gray-500 uppercase">
                        {step.group}
                      </div>
                      
                      <div className="flex flex-col md:items-center text-left md:text-center flex-1 ml-4 md:ml-0">
                        <div 
                          className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white mb-4 shadow-sm"
                          style={{ backgroundColor: 'var(--color-earist-maroon)', color: 'var(--color-earist-gold)' }}
                        >
                          <span className="text-lg font-bold">{step.number}</span>
                        </div>
                        <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                        <p className="text-sm text-gray-600">{step.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-16 rounded-xl bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <p className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 text-center">What to prepare</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-sm font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-gray-400" />
                  <span>Smartphone (or use kiosk)</span>
                </div>
                <div className="flex items-center gap-2">
                  <IdCard className="h-5 w-5 text-gray-400" />
                  <span>A valid ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-gray-400" />
                  <span>QR code ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4.5 Why scanning out is required */}
        <section id="why-exit" className="px-4 py-12 md:py-20" style={{ backgroundColor: 'var(--color-earist-maroon)' }}>
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-4 text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-earist-gold)' }}>
              {LANDING_CONTENT.whyExit.heading}
            </h2>
            <p className="mb-8 text-lg font-medium text-gray-200">
              {LANDING_CONTENT.whyExit.intro}
            </p>
            
            <div className="grid gap-6 sm:grid-cols-2">
              {LANDING_CONTENT.whyExit.points.map((point, i) => {
                const icons = [<Clock />, <Shield />, <FileCheck />, <ShieldCheck />];
                return (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 mt-1" style={{ color: 'var(--color-earist-gold)' }}>
                      {icons[i]}
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1">{point.title}</h3>
                      <p className="text-sm text-gray-300">{point.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 rounded-lg bg-black/20 p-4 border border-white/10">
              <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-earist-gold)' }} />
                {LANDING_CONTENT.whyExit.closing}
              </p>
            </div>
          </div>
        </section>

        {/* 4.6 Where to go */}
        <section id="where-to-go" className="scroll-mt-20 px-4 py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-3xl md:text-4xl font-bold">{LANDING_CONTENT.whereToGo.heading}</h2>
            
            <div className="grid gap-6 md:grid-cols-3">
              {LANDING_CONTENT.whereToGo.cards.map((card, i) => {
                const icons = [<Smartphone />, <ScanLine />, <ScanLine />];
                return (
                  <div key={i} className="flex flex-col rounded-xl border-2 border-gray-100 p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      {icons[i]}
                    </div>
                    <h3 className="mb-2 text-xl font-bold">{card.title}</h3>
                    <p className="mb-6 text-sm text-gray-600 flex-1">{card.text}</p>
                    <div className="rounded bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                      {card.location}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 text-center text-sm font-medium text-gray-600">
              {LANDING_CONTENT.whereToGo.validity}
            </div>
          </div>
        </section>

        {/* 4.7 FAQ */}
        <section id="faq" className="scroll-mt-20 px-4 py-16 md:py-24" style={{ backgroundColor: 'var(--color-canvas)' }}>
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-3xl md:text-4xl font-bold text-center">{LANDING_CONTENT.faq.heading}</h2>
            
            <div className="space-y-4">
              {LANDING_CONTENT.faq.items.map((item, i) => (
                <details 
                  key={i} 
                  className="group rounded-xl border border-gray-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden"
                  onToggle={(e) => {
                    if ((e.target as HTMLDetailsElement).open) {
                      setOpenFaq(i);
                    } else if (openFaq === i) {
                      setOpenFaq(null);
                    }
                  }}
                  open={openFaq === i}
                >
                  <summary className="flex cursor-pointer items-center justify-between p-5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E60000] rounded-xl">
                    <span>{item.q}</span>
                    <span className="ml-4 flex-shrink-0 transition-transform duration-200 group-open:rotate-180">
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 4.8 Your privacy */}
        <section id="privacy" className="scroll-mt-20 px-4 py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8" style={{ color: 'var(--color-earist-red)' }} />
              <h2 className="text-3xl md:text-4xl font-bold">{LANDING_CONTENT.privacy.heading}</h2>
            </div>
            
            <p className="mb-8 text-lg text-gray-700">
              {LANDING_CONTENT.privacy.intro}
            </p>
            
            <dl className="mb-8 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50">
              {LANDING_CONTENT.privacy.list.map((item, i) => (
                <div key={i} className="grid grid-cols-1 gap-1 p-5 sm:grid-cols-3 sm:gap-4">
                  <dt className="font-bold text-gray-900">{item.term}</dt>
                  <dd className="sm:col-span-2 text-gray-700">{item.def}</dd>
                </div>
              ))}
            </dl>
            
            <p className="text-sm font-medium text-gray-500">
              {LANDING_CONTENT.privacy.closing}
            </p>
          </div>
        </section>

        {/* 4.9 Final call to action */}
        <section className="px-4 py-16 md:py-20 text-center" style={{ backgroundColor: 'var(--color-earist-red)' }}>
          <h2 className="mb-8 text-3xl md:text-4xl font-bold text-white">
            {LANDING_CONTENT.finalCta.heading}
          </h2>
          <Link
            to="/get-pass"
            className="inline-flex items-center justify-center rounded-lg bg-white px-10 py-5 text-[18.66px] font-bold shadow-lg transition-transform active:scale-95 hover:bg-gray-50"
            style={{ color: 'var(--color-earist-maroon)' }}
          >
            {LANDING_CONTENT.finalCta.cta}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </section>
      </main>

      {/* 4.10 Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl flex flex-col items-center text-center">
          <img src="/earist-logo.png" alt="EARIST seal" className="mb-6 h-12 w-12 object-contain grayscale opacity-60" />
          
          <h2 className="mb-2 text-sm font-bold tracking-widest text-gray-900 uppercase">
            {LANDING_CONTENT.footer.officialName}
          </h2>
          <p className="mb-6 text-sm font-semibold" style={{ color: 'var(--color-earist-red)' }}>
            E-GatePass
          </p>
          
          <p className="mb-6 max-w-md text-sm text-gray-500 leading-relaxed">
            {LANDING_CONTENT.footer.contact}
          </p>
          
          <a 
            href={LANDING_CONTENT.footer.websiteLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-12 text-sm font-bold underline hover:text-[#E60000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E60000] rounded-sm px-1"
          >
            {LANDING_CONTENT.footer.websiteLink.text}
          </a>
          
          <p className="text-xs text-gray-400">
            {LANDING_CONTENT.footer.smallPrint}
          </p>
        </div>
      </footer>
    </div>
  );
}
