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

// ---- Dialog open/close (delegated; CSP-safe replacement for inline onclick) ----
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-dialog-open]')
  if (opener) {
    const dlg = document.getElementById(opener.dataset.dialogOpen)
    if (dlg && typeof dlg.showModal === 'function') dlg.showModal()
    return
  }
  const closer = e.target.closest('[data-dialog-close]')
  if (closer) {
    const dlg = closer.closest('dialog')
    if (dlg) dlg.close()
  }
})

// ---- Auto-submit on change (delegated; replaces inline onchange) ----
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-autosubmit]')
  if (el && el.form) el.form.submit()
})

// ---- Confirm-before-submit (delegated; replaces inline onsubmit) ----
document.addEventListener(
  'submit',
  (e) => {
    const form = e.target.closest('[data-confirm]')
    if (form && !window.confirm(form.dataset.confirm)) {
      e.preventDefault()
    }
  },
  true
)

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
