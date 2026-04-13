import React, { useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

const HomePage: React.FC = () => {
  const lettersRef = useRef<HTMLSpanElement[]>([])
  const heroSubRef = useRef<HTMLParagraphElement>(null)
  const lumioWordRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const mx = useRef(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)

  // Per-letter depth-of-field blur from mouse
  const applyBlurFromMouse = useCallback((x: number) => {
    const letters = lettersRef.current
    const wordEl = lumioWordRef.current
    if (!wordEl || letters.length === 0) return

    const wordRect = wordEl.getBoundingClientRect()
    const wordWidth = wordRect.width

    letters.forEach((letter) => {
      if (!letter) return
      const r = letter.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const dist = Math.abs(cx - x)
      const maxDist = wordWidth * 0.7
      const t = Math.min(dist / maxDist, 1)
      const blurAmount = t * t * 22
      const halftone = t * t * 0.85
      letter.style.filter = `blur(${blurAmount}px)`
      letter.style.setProperty('--halftone-opacity', String(halftone))
    })
  }, [])

  // Scroll blur + parallax
  const applyScrollBlur = useCallback((sy: number) => {
    const wordEl = lumioWordRef.current
    const subEl = heroSubRef.current
    if (!wordEl || !subEl) return

    const maxScroll = window.innerHeight * 0.6
    const t = Math.min(sy / maxScroll, 1)
    const subBlur = t * 20

    wordEl.style.transform = `translateY(${-sy * 0.35}px)`
    subEl.style.transform = `translateY(${-sy * 0.2}px)`
    subEl.style.filter = `blur(${subBlur}px)`
    subEl.style.opacity = String(Math.max(0.38 - t * 0.4, 0))
  }, [])

  useEffect(() => {
    const letters = lettersRef.current

    // Mouse move — blur effect
    const handleMouseMove = (e: MouseEvent) => {
      mx.current = e.clientX
      if (window.scrollY < window.innerHeight) {
        applyBlurFromMouse(e.clientX)
      }
    }

    // Hero leave — blur all
    const heroEl = heroRef.current
    const handleHeroLeave = () => {
      letters.forEach((l) => {
        if (!l) return
        l.style.filter = 'blur(12px)'
        l.style.setProperty('--halftone-opacity', '0.4')
      })
      if (heroSubRef.current) heroSubRef.current.style.filter = 'blur(6px)'
    }
    const handleHeroEnter = () => {
      if (heroSubRef.current) heroSubRef.current.style.filter = ''
    }

    // Scroll listener
    const handleScroll = () => {
      applyScrollBlur(window.scrollY)
      if (window.scrollY < window.innerHeight) {
        applyBlurFromMouse(mx.current)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    heroEl?.addEventListener('mouseleave', handleHeroLeave)
    heroEl?.addEventListener('mouseenter', handleHeroEnter)
    window.addEventListener('scroll', handleScroll)

    // Initial state: letters slightly blurry
    const offsets = [16, 10, 4, 10, 16]
    letters.forEach((l, i) => {
      if (!l) return
      l.style.filter = `blur(${offsets[i]}px)`
      l.style.setProperty('--halftone-opacity', String(offsets[i] / 30))
    })
    if (heroSubRef.current) heroSubRef.current.style.filter = 'blur(6px)'

    // Entrance animation
    const entranceTimer = setTimeout(() => {
      letters.forEach((l, i) => {
        if (!l) return
        setTimeout(() => {
          l.style.transition = 'filter 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          l.style.filter = 'blur(0px)'
          l.style.setProperty('--halftone-opacity', '0')
        }, i * 80)
      })
      setTimeout(() => {
        if (heroSubRef.current) {
          heroSubRef.current.style.filter = 'blur(0px)'
          heroSubRef.current.style.opacity = '0.38'
        }
        setTimeout(() => {
          const rest = [14, 8, 2, 8, 14]
          letters.forEach((l, i) => {
            if (!l) return
            l.style.filter = `blur(${rest[i]}px)`
          })
          if (heroSubRef.current) heroSubRef.current.style.filter = 'blur(4px)'
          applyBlurFromMouse(mx.current)
        }, 1200)
      }, 500)
    }, 400)

    // Scroll-reveal observer
    const reveals = document.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible')
        })
      },
      { threshold: 0.15 }
    )
    reveals.forEach((el) => observer.observe(el))

    return () => {
      clearTimeout(entranceTimer)
      document.removeEventListener('mousemove', handleMouseMove)
      heroEl?.removeEventListener('mouseleave', handleHeroLeave)
      heroEl?.removeEventListener('mouseenter', handleHeroEnter)
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [applyBlurFromMouse, applyScrollBlur])

  // Random jitter on letter hover
  const handleLetterHover = (e: React.MouseEvent<HTMLSpanElement>) => {
    const letter = e.currentTarget
    const tilt = (Math.random() - 0.5) * 14
    const scale = 0.97 + Math.random() * 0.06
    letter.style.transform = `rotate(${tilt}deg) scale(${scale})`
    setTimeout(() => {
      letter.style.transform = ''
    }, 350)
  }

  const letterChars = ['L', 'U', 'M', 'I', 'O']

  return (
    <div className="home-page">
      {/* Nav */}
      <nav className="home-nav">
        <div className="home-nav-logo">Unblur Studio</div>
        <ul className="home-nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#learn">Learn</a></li>
          <li><a href="#focus">Focus</a></li>
          <li><a href="#join">Join</a></li>
        </ul>
      </nav>

      {/* Hero */}
      <section className="home-hero" ref={heroRef} id="hero">
        <div className="home-lumio-word" ref={lumioWordRef}>
          {letterChars.map((char, i) => (
            <div className="home-letter-wrap" key={char}>
              <span
                className="home-letter"
                data-char={char}
                ref={(el) => { if (el) lettersRef.current[i] = el }}
                onMouseEnter={handleLetterHover}
              >
                {char}
              </span>
            </div>
          ))}
          <span className="home-letter-sup">²</span>
        </div>
        <p className="home-hero-sub" ref={heroSubRef}>
          Focus-first learning platform — built for ADHD minds
        </p>
      </section>

      <hr className="home-hr" />

      {/* Section 1 — What we do */}
      <section className="home-section" id="about">
        <div className="home-section-inner">
          <div className="home-section-label reveal">— What we do</div>
          <h2 className="home-section-heading reveal">
            Learning that<br /><em>actually</em> sticks.
          </h2>
          <p className="home-section-body reveal">
            Lumio is an AI-powered platform designed for the way ADHD brains work —
            short bursts, adaptive pacing, and real-time focus tracking. Not a workaround. A superpower.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="home-stats" id="learn">
        <div className="home-stat reveal">
          <div className="home-stat-num">3<span>×</span></div>
          <div className="home-stat-label">Faster retention</div>
        </div>
        <div className="home-stat reveal" style={{ transitionDelay: '0.1s' }}>
          <div className="home-stat-num">92<span>%</span></div>
          <div className="home-stat-label">Focus improvement</div>
        </div>
        <div className="home-stat reveal" style={{ transitionDelay: '0.2s' }}>
          <div className="home-stat-num">10<span>k+</span></div>
          <div className="home-stat-label">Active learners</div>
        </div>
      </div>

      {/* Section 2 — How it works */}
      <section className="home-section" id="focus">
        <div className="home-section-inner" style={{ marginLeft: 'auto' }}>
          <div className="home-section-label reveal">— How it works</div>
          <h2 className="home-section-heading reveal">
            Your focus.<br />Your flow.
          </h2>
          <p className="home-section-body reveal">
            Our CV module watches for distraction in real time. Our RAG engine adapts the lesson.
            You stay in the zone — without even noticing.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta-section" id="join">
        <div className="home-cta-big reveal">
          Start<br />focusing<br /><em>now.</em>
        </div>
        <p className="home-which-label reveal">— which are you?</p>
        <div className="home-role-btns reveal">
          <Link to="/login?role=student" className="home-role-btn">
            <span className="home-role-icon">✦</span>Student
          </Link>
          <Link to="/login?role=teacher" className="home-role-btn">
            <span className="home-role-icon">✦</span>Teacher
          </Link>
          <Link to="/login?role=parent" className="home-role-btn">
            <span className="home-role-icon">✦</span>Parent
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <span>© 2026 Lumio — by Unblur</span>
        <span>
          <a href="#">Privacy</a> &nbsp;·&nbsp;{' '}
          <a href="#">Terms</a> &nbsp;·&nbsp;{' '}
          <a href="#">Contact</a>
        </span>
      </footer>
    </div>
  )
}

export default HomePage
