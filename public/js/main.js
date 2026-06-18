// Maison — main bootstrap

// ---- Mobile nav toggle ----
const toggle = document.querySelector('.nav-toggle')
const navLinks = document.querySelector('.nav-links')

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', String(isOpen))
  })
}

// ---- Toast system ----
const toastRegion = document.getElementById('toast-region')

export function showToast(message, type = 'info', duration = 4000) {
  if (!toastRegion) return
  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.setAttribute('role', 'alert')
  toast.textContent = message
  toastRegion.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

// Show server-injected flash messages
document.querySelectorAll('[data-flash]').forEach((el) => {
  showToast(el.dataset.flash, el.dataset.flashType || 'info')
})

// ---- Scroll reveal ----
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1 }
  )

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    revealObserver.observe(el)
  })
}

// ---- AJAX form progressive enhancement ----
document.querySelectorAll('[data-ajax-form]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    const submitBtn = form.querySelector('[type="submit"]')
    if (submitBtn) submitBtn.disabled = true

    try {
      const res = await fetch(form.action || location.href, {
        method: form.method || 'POST',
        body: new FormData(form),
        headers: { 'x-requested-with': 'fetch' },
      })

      if (res.redirected) {
        location.href = res.url
        return
      }

      const json = await res.json().catch(() => null)
      if (json?.error) {
        e.preventDefault()
        showToast(json.error, 'error')
      } else if (json?.message) {
        showToast(json.message, 'success')
      }
    } catch {
      e.preventDefault()
      showToast('Не удалось отправить запрос. Проверьте соединение.', 'error')
    } finally {
      if (submitBtn) submitBtn.disabled = false
    }
  })
})
